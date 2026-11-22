-- Download Gateway: PostgreSQL schema (mirrors backend/app/models.py)
CREATE TABLE IF NOT EXISTS providers (
    id                SERIAL PRIMARY KEY,
    name              VARCHAR(120) NOT NULL UNIQUE,
    adapter           VARCHAR(50)  NOT NULL DEFAULT 'http_mirror',
    base_url          VARCHAR(512) NOT NULL,
    api_key           VARCHAR(512),
    cookies           TEXT,
    extra_headers     TEXT,
    priority          INTEGER      NOT NULL DEFAULT 100,
    is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
    timeout_seconds   INTEGER      NOT NULL DEFAULT 30,
    last_status       VARCHAR(20),
    last_checked_at   TIMESTAMPTZ,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_providers_priority ON providers (priority);

CREATE TABLE IF NOT EXISTS download_jobs (
    id                 UUID PRIMARY KEY,
    resource           VARCHAR(1024) NOT NULL,
    audio_only         BOOLEAN       NOT NULL DEFAULT FALSE,
    quality            VARCHAR(10),
    status             VARCHAR(20)   NOT NULL DEFAULT 'pending',
    provider_id        INTEGER REFERENCES providers(id) ON DELETE SET NULL,
    provider_attempts  TEXT,
    content_type       VARCHAR(120),
    file_path          VARCHAR(1024),
    filename           VARCHAR(255),
    content_length     BIGINT,
    bytes_transferred  BIGINT        NOT NULL DEFAULT 0,
    error              TEXT,
    started_at         TIMESTAMPTZ,
    finished_at        TIMESTAMPTZ,
    created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_download_jobs_status  ON download_jobs (status);
CREATE INDEX IF NOT EXISTS idx_download_jobs_created ON download_jobs (created_at);
