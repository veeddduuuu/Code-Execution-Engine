import { initialisePool, acquireContainer, cleanupOrphanedContainers } from "./apps/worker/src/pool/container-pool.ts";

async function runBenchmark() {
  console.log("Cleaning up any existing containers...");
  await cleanupOrphanedContainers();
  console.log("Cold Start: Creating a new container from scratch...");
  const start = performance.now();
  const container = await acquireContainer();
  const end = performance.now();

  console.log(`❄️ Cold Start Creation took: ${end - start} ms`);

  console.log("Cleaning up...");
  await cleanupOrphanedContainers();
  process.exit(0);
}

runBenchmark().catch(console.error);