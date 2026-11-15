-- =========================================
-- ASTRA V2 DATABASE SCHEMA
-- =========================================

-- 1. CREW MEMBERS

CREATE TABLE IF NOT EXISTS crew_members (
    id INTEGER PRIMARY KEY,
    crew_code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);


-- 2. SENSOR READINGS

CREATE TABLE IF NOT EXISTS sensor_readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    crew_id INTEGER NOT NULL,

    metric TEXT NOT NULL,
    value REAL NOT NULL,
    unit TEXT NOT NULL,

    source TEXT NOT NULL DEFAULT 'simulator',

    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (crew_id)
        REFERENCES crew_members(id)
);


-- 3. ALERTS

CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    crew_id INTEGER NOT NULL,
    report_id INTEGER,

    alert_type TEXT NOT NULL,
    severity TEXT NOT NULL,
    message TEXT NOT NULL,

    status TEXT NOT NULL DEFAULT 'open',

    triggered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at DATETIME,
    resolved_at DATETIME,

    astra_response_json TEXT,

    FOREIGN KEY (crew_id)
        REFERENCES crew_members(id),
    FOREIGN KEY (report_id)
        REFERENCES health_reports(id),

    CHECK (severity IN ('info', 'warning', 'critical')),
    CHECK (status IN ('open', 'acknowledged', 'resolved'))
);


-- 4. HEALTH REPORTS

CREATE TABLE IF NOT EXISTS health_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    crew_id INTEGER NOT NULL,

    body_region TEXT,
    symptoms_json TEXT NOT NULL,
    notes TEXT,

    reported_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    status TEXT NOT NULL DEFAULT 'new',

    astra_response_json TEXT,

    FOREIGN KEY (crew_id)
        REFERENCES crew_members(id),

    CHECK (status IN ('new', 'reviewed', 'escalated'))
);


-- =========================================
-- INDEXES FOR HISTORICAL DATA
-- =========================================

CREATE INDEX IF NOT EXISTS idx_readings_crew_time
ON sensor_readings(crew_id, recorded_at);

CREATE INDEX IF NOT EXISTS idx_alerts_crew_time
ON alerts(crew_id, triggered_at);

CREATE INDEX IF NOT EXISTS idx_reports_crew_time
ON health_reports(crew_id, reported_at);

CREATE INDEX IF NOT EXISTS idx_alerts_report_id
ON alerts(report_id);


-- =========================================
-- INITIAL CREW DATA
-- =========================================

INSERT OR IGNORE INTO crew_members
(id, crew_code, name, role)
VALUES
(1, 'ASTRA-001', 'Commander One', 'Commander'),
(2, 'ASTRA-002', 'Crew Member Two', 'Flight Engineer'),
(3, 'ASTRA-003', 'Crew Member Three', 'Mission Specialist'),
(4, 'ASTRA-004', 'Crew Member Four', 'Mission Specialist'),
(5, 'ASTRA-005', 'Crew Member Five', 'Medical Officer');