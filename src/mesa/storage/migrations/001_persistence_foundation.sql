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
    source_type TEXT,
    source_label TEXT,
    repo_url TEXT,
    repo_provider TEXT,
    repo_ref TEXT,
    commit_sha TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

ALTER TABLE scans ADD COLUMN IF NOT EXISTS source_type TEXT;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS source_label TEXT;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS repo_url TEXT;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS repo_provider TEXT;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS repo_ref TEXT;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS commit_sha TEXT;

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


CREATE TABLE IF NOT EXISTS policies (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    rule TEXT NOT NULL,
    severity TEXT NOT NULL,
    description TEXT,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_policies_project_id ON policies(project_id);

CREATE TABLE IF NOT EXISTS research_evaluation_records (
    id TEXT PRIMARY KEY,
    scan_id TEXT REFERENCES scans(id) ON DELETE SET NULL,
    repo_name TEXT NOT NULL,
    repo_url TEXT,
    commit_ref TEXT,
    scan_date TEXT,
    project_type TEXT,
    expected_services INTEGER CHECK (expected_services IS NULL OR expected_services >= 0),
    detected_services INTEGER NOT NULL DEFAULT 0 CHECK (detected_services >= 0),
    expected_patterns TEXT,
    detected_patterns TEXT,
    total_findings INTEGER NOT NULL DEFAULT 0 CHECK (total_findings >= 0),
    critical_findings INTEGER NOT NULL DEFAULT 0 CHECK (critical_findings >= 0),
    high_findings INTEGER NOT NULL DEFAULT 0 CHECK (high_findings >= 0),
    medium_findings INTEGER NOT NULL DEFAULT 0 CHECK (medium_findings >= 0),
    low_findings INTEGER NOT NULL DEFAULT 0 CHECK (low_findings >= 0),
    true_positives INTEGER CHECK (true_positives IS NULL OR true_positives >= 0),
    false_positives INTEGER CHECK (false_positives IS NULL OR false_positives >= 0),
    false_negatives INTEGER CHECK (false_negatives IS NULL OR false_negatives >= 0),
    precision NUMERIC(8, 4),
    recall NUMERIC(8, 4),
    f1_score NUMERIC(8, 4),
    notes TEXT,
    limitations TEXT,
    research_relevance TEXT,
    suitable_for_report BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_research_evaluation_records_scan_id ON research_evaluation_records(scan_id);

CREATE INDEX IF NOT EXISTS idx_scans_project_id ON scans(project_id);
CREATE INDEX IF NOT EXISTS idx_findings_scan_id ON findings(scan_id);
CREATE INDEX IF NOT EXISTS idx_services_scan_id ON services(scan_id);
CREATE INDEX IF NOT EXISTS idx_dependencies_scan_id ON dependencies(scan_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_project_id ON snapshots(project_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_scan_id ON snapshots(scan_id);
