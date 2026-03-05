import { processDueNotifications } from "./jobs/process-notifications.js";
import { prisma } from "./lib/prisma.js";

const POLL_MS = 60_000;

async function run() {
  try {
    const result = await processDueNotifications(new Date());
    console.log(`[worker] processed=${result.processed}`);
  } catch (error) {
    console.error("[worker] error", error);
  }
}

const interval = setInterval(run, POLL_MS);
run();

process.on("SIGINT", async () => {
  clearInterval(interval);
  await prisma.$disconnect();
  process.exit(0);
});
