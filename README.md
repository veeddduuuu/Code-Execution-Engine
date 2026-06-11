# CEE — Code Execution Engine

> Write code in a browser. Run it in a sandboxed Docker container. See output in real time.

**Stack:** Node.js · TypeScript · Docker · BullMQ · Redis · PostgreSQL · React · WebSockets  
**Status:** Building · v1.0

---

## What It Is

CEE is a production-grade, sandboxed code execution platform. You paste JavaScript or TypeScript into a Monaco editor, hit Run, and output streams back to your browser in real time — no local Node.js, no setup, no environment config.

Every execution is persisted to PostgreSQL. Every job has a deterministic state machine. Duplicate submissions are deduplicated via idempotency keys. Running jobs can be cancelled mid-flight. Containers are pre-warmed to eliminate cold-start latency. Workers are built for crash recovery and horizontal scaling from day one.

**Design rule: The API server orchestrates. The worker executes. Docker sandboxes. These three responsibilities never cross.**

---

## Architecture

```
Client (React + Monaco + Vite)
  │ REST (HTTP)          │ WebSocket
  ▼                      ▼
API Server (Node.js + Express)
  /execute  /jobs  /dlq  /health
  Zod Validation · Idempotency Check · Rate Limiting · WebSocket Server
  │
  │ enqueue job (BullMQ)
  ▼
Redis + BullMQ
  execution-queue · pub/sub · pool:node:available · log buffers · DLQ
  │
  │ worker pulls job
  ▼
Worker Process(es) [1..N]
  ExecutionWorker · ContainerPoolManager · CleanupWorker
  │
  │ dockerode SDK
  ▼
Docker Engine
  [warm pool containers] + [active job container]
  │
  ▼
PostgreSQL
  jobs · idempotency_keys
```

**Log streaming path:** Worker stdout → Redis pub/sub → API WebSocket server → Browser  
**Cancellation path:** Client `POST /cancel` → API publishes to `job:{id}:cancel` → Worker kills container → `CANCELLED` WS event → Browser

---

## Features

**Core Execution**
- Docker container execution for JS/TS (`node:20-alpine`)
- Execution state machine: `pending → running → completed | failed | cancelled | dead`
- 30-second hard timeout watchdog; container killed on breach
- Security baseline: `--cpus=0.5`, `--memory=128m`, `--network=none`, `--read-only`, non-root user

**Job System**
- BullMQ async job queue — 3 retries with exponential backoff (1s, 5s, 30s)
- Worker concurrency: 3 parallel jobs per worker instance
- Dead letter queue (DLQ): jobs exhausting retries stored with full error context
- Worker crash recovery: BullMQ stall detection re-queues orphaned jobs
- Multi-worker scaling: stateless workers share the same queue; BullMQ distributes automatically

**Reliability**
- PostgreSQL persistence: every job persisted with full audit trail — Redis is not the source of truth
- Idempotency keys: SHA-256 hashed, deduplicates submissions within a 24h window
- Execution cancellation: `POST /jobs/:id/cancel` — removes from queue or kills running container
- Warm container pool: N pre-started containers reduce cold-start from ~2s to ~8ms acquisition time

**Observability**
- Real-time WebSocket log streaming with stdout/stderr differentiation
- Log replay on reconnect (last 100 lines buffered in Redis per job, 24h TTL)
- `/health` endpoint: live DB + Redis + queue + pool status
- Execution timeline: per-job event trace with millisecond timestamps
- Operational observability dashboard: job latency, queue ingestion rate, sandbox boot time, DLQ management

**API**
- Rate limiting: 10 req/min per IP, Redis-backed, 429 with `Retry-After`
- Zod input validation on all request bodies
- Structured error codes: `TIMEOUT`, `OOM`, `EXIT_CODE_N`, `CANCELLED`, `JOB_NOT_FOUND`, etc.
- Versioned API under `/api/v1/`

---

## Local Setup

**Prerequisites:** Docker, Docker Compose, Node.js 20+, pnpm

```bash
# Clone the repo
git clone https://github.com/your-username/cee.git
cd cee

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env

# Start all services (API, worker-1, worker-2, Redis, PostgreSQL)
docker-compose up --build

# Verify everything is healthy
curl http://localhost:3000/api/v1/health
```

The API will be available at `http://localhost:3000`.  
The frontend (React + Vite) will be available at `http://localhost:5173`.

---

## Environment Variables
See `.env.example` for the full list of environment variables.

---

## API Reference

### Execution

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/v1/execute` | Submit code. Body: `{ code, language, idempotencyKey? }`. Returns `202 { jobId, status }`. |
| `GET` | `/api/v1/jobs/:id` | Poll job status, output, exitCode, timestamps. |
| `GET` | `/api/v1/jobs` | List recent jobs. Query: `?status=completed&language=js&limit=50` |
| `POST` | `/api/v1/jobs/:id/cancel` | Cancel pending or running job. Idempotent. |
| `POST` | `/api/v1/jobs/:id/rerun` | Re-submit a previous job with the same code. Returns new `jobId`. |

### Dead Letter Queue

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/v1/dlq` | List dead jobs with full error context. |
| `POST` | `/api/v1/dlq/:id/replay` | Re-enqueue a dead job as a new execution. |

### WebSocket Protocol

Connect to `ws://localhost:3000/ws`, then:

```json
// Subscribe to a job's log stream
{ "type": "SUBSCRIBE", "jobId": "job_abc123" }

// Receive streaming output
{ "type": "LOG", "stream": "stdout", "data": "Hello World", "ts": 1712345678 }
{ "type": "LOG", "stream": "stderr", "data": "Error: oops", "ts": 1712345679 }

// Execution complete
{ "type": "DONE", "status": "completed", "exitCode": 0 }

// Job cancelled
{ "type": "CANCELLED", "reason": "user_requested" }
```

---

## Job State Machine

```
pending  → (worker picks up)          → running
running  → (success, exitCode 0)      → completed
running  → (error / timeout / OOM)    → failed
running  → (cancel signal received)   → cancelled
failed   → (attempt < 3)              → pending [re-enqueued]
failed   → (attempt === 3)            → dead [DLQ]
pending  → (cancel before pickup)     → cancelled
```

---

## Security Model

Every code submission is treated as hostile.

**Container-level controls:**
- `--cpus=0.5` — CPU exhaustion prevention
- `--memory=128m --memory-swap=128m` — memory bomb prevention
- `--network=none` — no data exfiltration, no C2 beaconing
- `--read-only` + tmpfs `/tmp` — rootkit persistence prevention
- `USER runner` in Dockerfile — privilege escalation prevention
- 30-second hard kill — infinite loop prevention


## Project Structure

```
cee/
├── apps/
│   ├── api/          # Express API server + WebSocket server
│   ├── worker/       # BullMQ worker + ContainerPoolManager
│   └── frontend/     # React + Vite + Monaco Editor
├── packages/
│   ├── types/        # Shared TypeScript types
│   ├── config/       # Shared tsconfig base
│   └── queues/       # BullMQ queue definitions
├── docker-compose.yml
├── Dockerfile.api
├── Dockerfile.worker
└── .env.example
```

---

## Deployment

The project ships to AWS EC2 via GitHub Actions on every merge to `main`.

**CI** (on PR): `pnpm install → tsc --noEmit → eslint → vitest → docker build`  
**CD** (on merge to main): build Docker images → push to GHCR → SSH into EC2 → `docker-compose pull && up -d`

EC2 runs behind an Nginx reverse proxy with HTTPS termination (Let's Encrypt) and WebSocket upgrade headers.

---

## Key Architectural Decisions

| Decision | Chosen | Rejected | Reason |
|---|---|---|---|
| Persistence | PostgreSQL from day one | In-memory Map → migrate later | Avoid data loss on restart |
| Pool storage | Redis list (LPOP atomic) | In-memory Map per worker | Survives worker restart; multi-worker safe |
| Cancellation | Redis signal channel | Polling Postgres flag | Lower latency; worker already has Redis connection |
| Worker scaling | Stateless + shared queue | Dedicated worker per job type | BullMQ handles distribution automatically |
| Deployment | EC2 + Docker Compose + Nginx | Kubernetes | Sufficient for portfolio; no K8s overhead |

---

*"If the container leaks, the product fails. If the worker crashes, the job must survive."*