import { createConnection, Socket } from 'node:net';
import { ParseProtocolData } from './utils';

interface ConnObj {
	remote_socket?: Socket;
	protocol_header?: Buffer<ArrayBuffer>;
	protocol_header_sent?: boolean;
	idle_timer?: ReturnType<typeof setTimeout>;
}

async function waitForFirstData(ws: WebSocket): Promise<Buffer<ArrayBuffer>> {
	return new Promise((resolve, reject) => {
		function onDataCallback(event: MessageEvent) {
			ws.removeEventListener('message', onDataCallback);
			// @ts-ignore
			resolve(Buffer.from(event.data));
		}

		ws.addEventListener('message', onDataCallback);
	});
}

async function HandleWsUpgrade(ws: WebSocket, request: Request, user: Buffer<ArrayBuffer>): Promise<void> {
	ws.accept();

	try {
		const raw_data = request.headers.get('sec-websocket-protocol')
			? Buffer.from(request.headers.get('sec-websocket-protocol') as string, 'base64url')
			: await waitForFirstData(ws);

		const conn_obj = {} as ConnObj;
		const { address, version, is_udp, raw_data_offset } = ParseProtocolData(raw_data, user);

		if (is_udp) {
			if (address.port !== 53) {
				ws.close();
				return;
			}

			// redirect all dns request to DNS Over TCP
			address.host = '8.8.8.8';
		}

		conn_obj.remote_socket = createConnection(
			{
				host: address.host,
				port: address.port,
				family: 4, // no effect though.
			},
			() => {
				console.log(`${address.host}:${address.port} connection initiated`);
			}
		);

		conn_obj.remote_socket.push(new Uint8Array([version, 0]));
		conn_obj.remote_socket.on('data', (chunk) => ws.send(chunk.buffer));
		conn_obj.remote_socket.on('close', () => ws.close());
		conn_obj.remote_socket.write(raw_data.subarray(raw_data_offset));

		ws.addEventListener('message', (event) => {
			// @ts-ignore
			conn_obj.remote_socket!.write(Buffer.from(event.data));
		});

		ws.addEventListener('close', () => {
			console.log('websocket session closed');
			if (conn_obj.remote_socket && !conn_obj.remote_socket.closed) {
				conn_obj.remote_socket.destroy();
			}

			if (ws.readyState === WebSocket.OPEN) {
				ws.close();
			}
		});
	} catch (error: any) {
		console.log('exception', error.message);
		ws.close();
	}
}

export default {
	async fetch(request, env): Promise<Response> {
		if (request.headers.get('Connection') === 'Upgrade' && request.headers.get('Upgrade') === 'websocket') {
			if (!env.USER) {
				return new Response(null, {
					status: 500,
				});
			}

			const { 0: client, 1: server } = new WebSocketPair();

			HandleWsUpgrade(server, request, Buffer.from(env.USER.replaceAll('-', ''), 'hex')).catch((err) => {
				console.log(err);
			});

			const headers: HeadersInit = {};

			if (request.headers.get('sec-websocket-protocol')) {
				headers['sec-websocket-protocol'] = request.headers.get('sec-websocket-protocol') as string;
			}

			return new Response(null, {
				status: 101,
				webSocket: client,
				headers,
			});
		}

		return new Response(`Hello worker!`);
	},
} satisfies ExportedHandler<Env>;
