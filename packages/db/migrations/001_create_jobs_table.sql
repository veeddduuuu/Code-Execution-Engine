DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_status') THEN
        CREATE TYPE job_status AS ENUM ('pending', 'running', 'completed', 'failed', 'dead');
    END IF;
END$$;

CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY,
    code TEXT NOT NULL,
    language TEXT NOT NULL,

    status job_status NOT NULL DEFAULT 'pending',

    attempts_made INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 3,

    output TEXT,
    exit_code INT,

    error_message TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

