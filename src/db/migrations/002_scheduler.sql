-- Schema Migration: 002_scheduler.sql
-- Description: Durable job store for scheduled variant publications with atomic claiming and retry state

CREATE TABLE IF NOT EXISTS scheduled_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID NOT NULL REFERENCES variants(id) ON DELETE CASCADE,
    slot_id UUID NOT NULL REFERENCES slots(id) ON DELETE CASCADE,
    scheduled_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'published', 'failed')),
    attempts INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 3,
    claimed_at TIMESTAMPTZ NULL,
    available_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_error JSONB NULL,
    published_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_scheduled_jobs_variant_slot UNIQUE (variant_id, slot_id)
);

CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_due ON scheduled_jobs(status, scheduled_at, available_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_variant_id ON scheduled_jobs(variant_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_status ON scheduled_jobs(status);
