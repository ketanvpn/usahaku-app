import app from "./app";
import { logger } from "./lib/logger";
import { seed } from "./seed";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Default bind ke 127.0.0.1 supaya backend tidak terbuka ke jaringan lain.
// Untuk skenario dev yang perlu diakses dari device lain, set HOST=0.0.0.0
// secara eksplisit.
const host = process.env["HOST"] && process.env["HOST"].trim().length > 0
  ? process.env["HOST"]
  : "127.0.0.1";

function startListening(): void {
  app.listen(port, host, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ host, port }, "Server listening");
  });
}

seed()
  .then(() => {
    startListening();
  })
  .catch((err) => {
    logger.error({ err }, "Seed failed, starting anyway");
    startListening();
  });
