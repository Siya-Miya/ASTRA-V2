
const db = require("../database/connection");
const { buildKnowledgeAnswer } = require("./knowledgeAnswer");

// Demo-only rules.
// These values are for testing ASTRA's alert behaviour,
// NOT medical thresholds.

const alertRules = {
    heart_rate: {
        threshold: 100,
        persistenceSeconds: 20,
        windowSeconds: 35,
        minimumReadings: 5
    }
};

function evaluateReading(crewId, metric) {

    const rule = alertRules[metric];

    if (!rule) {
        return null;
    }

    // Retrieve recent readings within the evaluation window.
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
        `-${rule.windowSeconds} seconds`
    );

    if (recent.total < rule.minimumReadings) {
        return null;
    }

    // Calculate how long the readings have persisted.
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

    // Every reading must exceed the demo threshold.
    if (recent.minimum <= rule.threshold) {
        return null;
    }

    const alertType = `${metric}_persistent_anomaly`;

    // Prevent duplicate active alerts.
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

    // Ask ASTRA's research service for relevant information.
    let astraResponse = null;

    try {

        const question =
            `What does a persistent ${metric.replace("_", " ")} anomaly mean in a spaceflight context, and what research guidance is available?`;

        astraResponse = buildKnowledgeAnswer(question);

    } catch (error) {

        console.error("ASTRA response generation error:", error);

    }

    // Save the alert and ASTRA's response together.
    const result = db.prepare(`
        INSERT INTO alerts (
            crew_id,
            alert_type,
            severity,
            message,
            astra_response_json
        )
        VALUES (?, ?, ?, ?, ?)
    `).run(
        crewId,
        alertType,
        "warning",
        `Persistent ${metric.replace("_", " ")} anomaly detected. Investigation recommended.`,
        astraResponse ? JSON.stringify(astraResponse) : null
    );

    console.log(`Alert created for crew ${crewId}: ${alertType}`);

    return result.lastInsertRowid;
}

module.exports = { evaluateReading };
