# CEE — Code Execution Engine

> Write code in a browser. Run it in a sandboxed Docker container. See output in real time.

CEE is a sandboxed code execution platform for running user-submitted JavaScript safely and reliably. It combines a browser editor, an orchestration API, a BullMQ/Redis job queue, Docker-based sandboxing, PostgreSQL persistence, and real-time WebSocket streaming.

The project is built around one rule:

**API orchestrates. Worker executes. Docker isolates.**

## What it does

* Write JavaScript in a Monaco editor
* Submit jobs asynchronously through BullMQ
* Run code inside pre-warmed Docker containers
* Stream stdout/stderr back to the browser in real time
* Persist every execution in PostgreSQL
* Cancel pending or running jobs
* Replay dead-letter jobs
* Inspect live queue, worker, pool, and DLQ metrics from the UI

## Architecture

```text
Client (React + Monaco + Vite)
  ├─ POST /api/v1/execute
  ├─ GET  /api/v1/jobs/:id
  ├─ POST /api/v1/jobs/:id/cancel
  └─ WebSocket /ws
        ↓
API Server (Node.js + Express)
  ├─ input validation
  ├─ rate limiting
  ├─ idempotency checks
  ├─ PostgreSQL persistence
  ├─ job state orchestration
  └─ WebSocket fan-out
        ↓
Redis + BullMQ
  ├─ execution queue
  ├─ pub/sub log stream
  ├─ retry/backoff
  └─ DLQ tracking
        ↓
Worker Process(es)
  ├─ claim job
  ├─ acquire warm container
  ├─ execute code in Docker
  ├─ publish logs
  └─ finalize job state
        ↓
PostgreSQL
  ├─ jobs
  └─ idempotency_keys
```

## Execution lifecycle

1. User writes code in the browser.
2. Frontend submits the job to `POST /api/v1/execute`.
3. API validates the request, stores the job in PostgreSQL, and enqueues it in BullMQ.
4. Worker picks up the job and runs it inside a Docker container.
5. Stdout/stderr are streamed through Redis pub/sub.
6. API forwards logs to the browser over WebSocket.
7. Final job state is written back to PostgreSQL.

## Features

### 1) Warm container pool

CEE keeps a pre-warmed pool of idle Docker containers so execution can start fast instead of waiting for a cold boot every time. The pool is visible in the UI, along with live counts for warm capacity, available containers, active allocations, and pool state.

Why this matters: warm checkout removes a lot of wasted startup latency and makes the system feel responsive even when jobs are coming in quickly.

### 2) Security and sandboxing

Every submission is treated as hostile.

* Non-root execution inside the container
* Network disabled inside the sandbox
* Read-only filesystem where possible
* Memory and CPU limits per container
* Hard timeout for runaway or infinite-loop jobs

Why this matters: the sandbox is the product. If the container leaks, the system is broken.

### 3) Idempotency

CEE supports idempotency keys so duplicate submissions do not create duplicate jobs. Keys are hashed and checked against recent executions before a new job is created.

Why this matters: retries, double-clicks, and flaky networks should not create chaos in the queue.

### 4) Queueing, retries, and DLQ

BullMQ handles job dispatch, retries, and backoff. Failed jobs are retried, and once retries are exhausted they move into the dead-letter queue for inspection and replay.

Why this matters: failures become visible and recoverable instead of disappearing into the void like a bad group project.

### 5) Health and boot sequence

The health system checks the API, PostgreSQL, Redis, queue, and worker state. The UI also exposes a boot/status sequence so you can see the system move through startup and readiness instead of guessing.

Why this matters: a “working” system is not just one that returns 200; it is one that tells you what is alive, warming, degraded, or unavailable.

### 6) Observability and monitoring

The UI is intentionally educational. It shows live queue depth, worker count, warm pool state, DLQ status, execution history, and latency metrics. It also includes an execution timeline drawer with step-by-step events for each request.

Why this matters: this project is not just about running code, it is about understanding the system.

## UI focus

The frontend is not a throwaway shell. It is built to explain the backend.

* Monaco editor for writing code
* Emulated terminal for runtime output
* Status strip for system health and queue state
* Architecture flow panel for request path visualization
* System focus panel for queue / workers / pool / DLQ inspection
* Execution timeline drawer for tracing one request from submit to completion
* Observability dashboard for boot state and live subsystem metrics

## API

Base path: `/api/v1`

### Execution

| Method | Route              | Description                     |
| ------ | ------------------ | ------------------------------- |
| `POST` | `/execute`         | Submit code for execution       |
| `GET`  | `/jobs/:id`        | Fetch job status and output     |
| `GET`  | `/jobs`            | List recent jobs                |
| `POST` | `/jobs/:id/cancel` | Cancel a pending or running job |
| `GET`  | `/dlq`             | View dead-letter jobs           |
| `POST` | `/dlq/:id/replay`  | Re-enqueue a dead job           |

### Health

| Method | Route     | Description                                    |
| ------ | --------- | ---------------------------------------------- |
| `GET`  | `/health` | Check API, DB, Redis, queue, and worker health |

### WebSocket

Connect to:

```text
ws://localhost:3000/ws
```

#### Subscribe to a job

```json
{ "type": "SUBSCRIBE", "jobId": "job_abc123" }
```

#### Log events

```json
{ "type": "LOG", "stream": "stdout", "data": "Hello World", "ts": 1712345678 }
{ "type": "LOG", "stream": "stderr", "data": "Error: oops", "ts": 1712345679 }
```

#### Completion events

```json
{ "type": "DONE", "status": "completed", "exitCode": 0 }
{ "type": "CANCELLED", "reason": "user_requested" }
```

## Job states

```text
pending  → running → completed
pending  → running → failed
pending  → cancelled
running  → cancelled
running  → failed → dead
```

## Tech stack

* **Frontend:** React, Vite, Monaco Editor
* **API:** Node.js, Express, TypeScript
* **Queue:** BullMQ, Redis
* **Database:** PostgreSQL
* **Realtime:** WebSockets
* **Sandbox:** Docker

## Project structure

```text
cee/
├── apps/
│   ├── api/          # Express API server + WebSocket server
│   ├── worker/       # BullMQ worker + container manager
│   └── frontend/     # React + Vite + Monaco Editor
├── packages/
│   ├── types/        # Shared TypeScript types
│   ├── config/       # Shared configuration
│   └── queues/       # BullMQ queue definitions
├── docker-compose.yml
├── Dockerfile.api
├── Dockerfile.worker
└── .env.example
```

## Local development

### Prerequisites

* Docker
* Docker Compose
* Node.js 20+
* pnpm

### Setup

```bash
git clone https://github.com/your-username/cee.git
cd cee
pnpm install
cp .env.example .env
docker-compose up --build
```

### Verify

```bash
curl http://localhost:3000/api/v1/health
```

Frontend:

```text
http://localhost:5173
```

API:

```text
http://localhost:3000
```

## Environment variables

See `.env.example` for the full list.

## Deployment

The project is designed to run with Docker-based deployment on a single VM or container host.

A typical production setup includes:

* GitHub Actions for CI/CD
* Docker images for API and worker
* PostgreSQL and Redis services
* Reverse proxy with HTTPS termination
* WebSocket upgrade support

## Notes

This project is intentionally built as a clean separation of concerns:

* the API never executes code
* the worker never serves the UI
* Docker handles isolation, not application logic

That separation keeps the system easier to scale, debug, and reason about.
