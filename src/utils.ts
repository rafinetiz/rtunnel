interface VAddressData {
	host: string;
	port: number;
	type: number;
}

interface VProtocolData {
	address: VAddressData;
	version: number;
	raw_data_offset: number;
	is_udp: boolean;
}

export function ParseProtocolData(buffer: Buffer<ArrayBuffer>, user: Buffer<ArrayBuffer>): VProtocolData {
	if (buffer.byteLength < 24) {
		throw new Error('invalid protocol data');
	}

	const version = buffer.readUint8(0);
	const identifier = buffer.subarray(1, 17);

	if (!identifier.equals(user)) {
		throw new Error("protocol identifier didn't match");
	}

	const opt_len = buffer.readUint8(17);
	const command_offset = 18 + opt_len;
	const command = buffer.readUint8(command_offset);

	if (command !== 1 && command !== 2) {
		throw new Error('invalid protocol command');
	}

	const port = buffer.readUInt16BE(command_offset + 1);
	const addrtype = buffer.readUInt8(command_offset + 3);
	const address = { port, type: addrtype } as VAddressData;

	let address_offset = command_offset + 4,
		address_len = 4;

	switch (addrtype) {
		case 1: // IPv4
			address.host = buffer.subarray(address_offset, address_offset + address_len).join('.');
			break;
		case 2: // Domain
			address_len = buffer.readUInt8(address_offset++);
			address.host = buffer.subarray(address_offset, address_offset + address_len).toString();
			break;
		case 3: // IPv6
			address_len = 16;
			const tmp_host = [];

			for (let i = address_offset; i < address_offset + address_len; i += 2) {
				tmp_host.push(buffer.subarray(i, i + 2).toString('hex'));
			}

			address.host = tmp_host.join(':');
			break;
		default:
			throw new Error('invalid protocol address type');
	}

	return {
		address,
		version,
		raw_data_offset: address_offset + address_len,
		is_udp: command === 2,
	};
}
