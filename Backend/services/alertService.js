const db = require("../database/connection");

// Demo-only rules.
// These values are for testing ASTRA's alert behaviour,
// NOT medical thresholds.

const alertRules = {
    heart_rate: {
        threshold: 100,
        persistenceSeconds: 20,
        minimumReadings: 5
    }
};


function evaluateReading(crewId, metric) {

    const rule = alertRules[metric];

    // No configured rule for this metric
    if (!rule) {
        return null;
    }

    // Retrieve recent readings within the persistence window
    const recent = db.prepare(`
        SELECT
            COUNT(*) AS total,
            MIN(value) AS minimum,
            MIN(recorded_at) AS first_reading,
            MAX(recorded_at) AS last_reading
        FROM sensor_readings
        WHERE crew_id = ?
        AND metric = ?
        AND recorded_at >= datetime('now', ?)
    `).get(
        crewId,
        metric,
        `-${rule.persistenceSeconds} seconds`
    );

    // Not enough readings to evaluate persistence
    if (recent.total < rule.minimumReadings) {
        return null;
    }

    // Check whether the readings span the required duration
    const duration = db.prepare(`
        SELECT
            (julianday(?) - julianday(?)) * 86400 AS seconds
    `).get(
        recent.last_reading,
        recent.first_reading
    ).seconds;

    if (duration < rule.persistenceSeconds) {
        return null;
    }

    // Every reading in the window must exceed the demo threshold
    if (recent.minimum <= rule.threshold) {
        return null;
    }

    const alertType = `${metric}_persistent_anomaly`;

    // Prevent duplicate active alerts
    const existingAlert = db.prepare(`
        SELECT id
        FROM alerts
        WHERE crew_id = ?
        AND alert_type = ?
        AND status IN ('open', 'acknowledged')
    `).get(crewId, alertType);

    if (existingAlert) {
        return null;
    }

    // Create the alert
    const result = db.prepare(`
        INSERT INTO alerts (
            crew_id,
            alert_type,
            severity,
            message
        )
        VALUES (?, ?, ?, ?)
    `).run(
        crewId,
        alertType,
        "warning",
        `Persistent ${metric.replace("_", " ")} anomaly detected. Investigation recommended.`
    );

    console.log(`Alert created for crew ${crewId}: ${alertType}`);

    return result.lastInsertRowid;
}


module.exports = { evaluateReading };