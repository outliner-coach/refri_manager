import http from "node:http";
import https from "node:https";

const PORT = Number(process.env.REFRI_PROXY_PORT ?? 8080);
const WEB_TARGET = new URL(process.env.REFRI_WEB_TARGET ?? "http://127.0.0.1:3000");
const API_TARGET = new URL(process.env.REFRI_API_TARGET ?? "http://[::1]:4000");
const STORAGE_TARGET = new URL(process.env.REFRI_STORAGE_TARGET ?? "http://[::1]:9100");

function resolveTarget(pathname) {
  if (pathname === "/health" || pathname.startsWith("/v1/")) {
    return { target: API_TARGET, path: pathname };
  }
  if (pathname.startsWith("/storage/")) {
    return { target: STORAGE_TARGET, path: pathname.replace(/^\/storage/, "") || "/", preserveHost: true };
  }
  return { target: WEB_TARGET, path: pathname, preserveHost: false };
}

function getRequestClient(target) {
  return target.protocol === "https:" ? https.request : http.request;
}

const server = http.createServer((request, response) => {
  if (!request.url) {
    response.writeHead(400).end("Missing URL");
    return;
  }

  const incomingUrl = new URL(request.url, "http://local-proxy");
  const { target, path, preserveHost = false } = resolveTarget(incomingUrl.pathname);
  const proxyPath = `${path}${incomingUrl.search}`;
  const client = getRequestClient(target);
  const forwardedProto = request.headers["x-forwarded-proto"];
  const forwardedHost = request.headers["x-forwarded-host"];
  const originalHost = request.headers.host;

  const proxyRequest = client(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || (target.protocol === "https:" ? 443 : 80),
      method: request.method,
      path: proxyPath,
      headers: {
        ...request.headers,
        host: preserveHost ? originalHost ?? target.host : target.host,
        "x-forwarded-host": Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost ?? request.headers.host,
        "x-forwarded-proto": Array.isArray(forwardedProto)
          ? forwardedProto[0]
          : forwardedProto ?? "http",
        connection: "close"
      }
    },
    (proxyResponse) => {
      response.writeHead(proxyResponse.statusCode ?? 502, proxyResponse.headers);
      proxyResponse.pipe(response);
    }
  );

  proxyRequest.on("error", (error) => {
    response.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    response.end(`Proxy error: ${error.message}`);
  });

  request.pipe(proxyRequest);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(
    `[public-proxy] listening on http://0.0.0.0:${PORT} -> web ${WEB_TARGET.href}, api ${API_TARGET.href}, storage ${STORAGE_TARGET.href}`
  );
});
