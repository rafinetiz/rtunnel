# RTunnel

make your cloudflare workers as tunnel for VLESS Protocol

# Install

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/rafinetiz/rtunnel)

# Environment Variables

| Name   | Required | Description                                           |
| ------ | -------- | ----------------------------------------------------- |
| `USER` | **Yes**  | User idenfication. currently only single user allowed |

# Known issues

1. workers can't connect to ip owned by Cloudflare as stated [here](https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/#_top)
