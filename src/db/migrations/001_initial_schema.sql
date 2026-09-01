-- Schema Migration: 001_initial_schema.sql
-- Description: Social Media Studio initial relational schema with strict idempotency constraints

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: posts
CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('url', 'markdown')),
    source_url TEXT NULL,
    source_content TEXT NOT NULL,
    title VARCHAR(255) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table: variants
CREATE TABLE IF NOT EXISTS variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    platform VARCHAR(30) NOT NULL CHECK (platform IN ('discord', 'mock_x', 'mock_linkedin')),
    content TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'rejected', 'published')),
    validation_info JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_variants_post_id ON variants(post_id);
CREATE INDEX IF NOT EXISTS idx_variants_platform_status ON variants(platform, status);

-- Table: slots
CREATE TABLE IF NOT EXISTS slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID NOT NULL REFERENCES variants(id) ON DELETE CASCADE,
    scheduled_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'cancelled', 'completed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_slots_variant_id ON slots(variant_id);
CREATE INDEX IF NOT EXISTS idx_slots_scheduled_status ON slots(scheduled_at, status);

-- Table: publish_attempts
CREATE TABLE IF NOT EXISTS publish_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID NOT NULL REFERENCES variants(id) ON DELETE CASCADE,
    slot_id UUID NOT NULL REFERENCES slots(id) ON DELETE CASCADE,
    idempotency_key VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ NULL,
    external_post_id VARCHAR(255) NULL,
    error_info JSONB NULL,
    metadata JSONB NULL,
    
    -- Critical Invariant: SAME VARIANT + SAME SLOT = EXACTLY ONE PUBLICATION
    CONSTRAINT uq_publish_attempts_variant_slot UNIQUE (variant_id, slot_id),
    CONSTRAINT uq_publish_attempts_idempotency_key UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_publish_attempts_variant_slot ON publish_attempts(variant_id, slot_id);
