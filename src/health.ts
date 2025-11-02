import http from "http";
import { logger } from "./utils/logger.js";

const PORT = process.env.PORT || 8080;

export function startHealthCheckServer(): void {
  const server = http.createServer((req, res) => {
    if (req.url === "/health" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ok",
          timestamp: new Date().toISOString(),
          service: "trading-bot",
        })
      );
    } else {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
    }
  });

  server.listen(PORT, () => {
    logger.info(`🏥 Health check server running on port ${PORT}`);
  });
}
