CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    root_path TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scans (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    service_count INTEGER NOT NULL DEFAULT 0,
    finding_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS services (
    id BIGSERIAL PRIMARY KEY,
    scan_id TEXT NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    root_path TEXT NOT NULL,
    language TEXT NOT NULL,
    endpoint_count INTEGER NOT NULL DEFAULT 0,
    outbound_call_count INTEGER NOT NULL DEFAULT 0,
    database_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS dependencies (
    id BIGSERIAL PRIMARY KEY,
    scan_id TEXT NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    source_service TEXT NOT NULL,
    target_service TEXT NOT NULL,
    dependency_type TEXT NOT NULL,
    evidence JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS findings (
    id TEXT NOT NULL,
    scan_id TEXT NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    severity TEXT NOT NULL,
    confidence NUMERIC(5, 4) NOT NULL,
    services JSONB NOT NULL,
    description TEXT NOT NULL,
    evidence JSONB NOT NULL,
    recommendation TEXT NOT NULL,
    PRIMARY KEY (scan_id, id)
);

CREATE TABLE IF NOT EXISTS scores (
    id BIGSERIAL PRIMARY KEY,
    scan_id TEXT NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    scope TEXT NOT NULL,
    target TEXT NOT NULL,
    score NUMERIC(5, 2) NOT NULL,
    breakdown JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS reports (
    id BIGSERIAL PRIMARY KEY,
    scan_id TEXT NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    format TEXT NOT NULL DEFAULT 'json',
    content JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS snapshots (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    scan_id TEXT NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    graph JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scans_project_id ON scans(project_id);
CREATE INDEX IF NOT EXISTS idx_findings_scan_id ON findings(scan_id);
CREATE INDEX IF NOT EXISTS idx_services_scan_id ON services(scan_id);
CREATE INDEX IF NOT EXISTS idx_dependencies_scan_id ON dependencies(scan_id);
