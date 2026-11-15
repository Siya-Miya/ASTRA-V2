
const db = require("../database/connection");
const { buildKnowledgeAnswer } = require("./knowledgeAnswer");

// =========================================
// ASTRA V2 — ANOMALY DETECTION ENGINE
// =========================================

// Illustrative demo / mission-configured thresholds.
// These are NOT official NASA, clinical or spacecraft
// safety limits. Real deployment requires approved rules.

const alertRules = {

    heart_rate: {
        unit: "bpm",
        persistenceSeconds: 20,
        windowSeconds: 35,
        minimumReadings: 5,
        recoveryWindowSeconds: 25,
        recoveryPersistenceSeconds: 15,

        high: { threshold: 100, recoveryThreshold: 95 },
        low: { threshold: 50, recoveryThreshold: 55 }
    },

    oxygen_saturation: {
        unit: "%",
        persistenceSeconds: 20,
        windowSeconds: 35,
        minimumReadings: 5,
        recoveryWindowSeconds: 25,
        recoveryPersistenceSeconds: 15,

        low: { threshold: 96, recoveryThreshold: 97 }
    },

    body_temperature: {
        unit: "°C",
        persistenceSeconds: 20,
        windowSeconds: 35,
        minimumReadings: 5,
        recoveryWindowSeconds: 25,
        recoveryPersistenceSeconds: 15,

        high: { threshold: 37.2, recoveryThreshold: 37.0 },
        low: { threshold: 36.4, recoveryThreshold: 36.6 }
    },

    respiratory_rate: {
        unit: "breaths/min",
        persistenceSeconds: 20,
        windowSeconds: 35,
        minimumReadings: 5,
        recoveryWindowSeconds: 25,
        recoveryPersistenceSeconds: 15,

        high: { threshold: 25, recoveryThreshold: 23 },
        low: { threshold: 8, recoveryThreshold: 10 }
    },

    cabin_temperature: {
        unit: "°C",
        persistenceSeconds: 20,
        windowSeconds: 35,
        minimumReadings: 5,
        recoveryWindowSeconds: 25,
        recoveryPersistenceSeconds: 15,

        high: { threshold: 26, recoveryThreshold: 25 },
        low: { threshold: 18, recoveryThreshold: 19 }
    },

    cabin_pressure: {
        unit: "kPa",
        persistenceSeconds: 20,
        windowSeconds: 35,
        minimumReadings: 5,
        recoveryWindowSeconds: 25,
        recoveryPersistenceSeconds: 15,

        high: { threshold: 105, recoveryThreshold: 104 },
        low: { threshold: 97, recoveryThreshold: 98 }
    },

    cabin_oxygen: {
        unit: "%",
        persistenceSeconds: 20,
        windowSeconds: 35,
        minimumReadings: 5,
        recoveryWindowSeconds: 25,
        recoveryPersistenceSeconds: 15,

        high: { threshold: 23, recoveryThreshold: 22.5 },
        low: { threshold: 19.5, recoveryThreshold: 20 }
    },

    carbon_dioxide: {
        unit: "%",
        persistenceSeconds: 20,
        windowSeconds: 35,
        minimumReadings: 5,
        recoveryWindowSeconds: 25,
        recoveryPersistenceSeconds: 15,

        high: { threshold: 0.5, recoveryThreshold: 0.4 }
    },

    humidity: {
        unit: "%",
        persistenceSeconds: 20,
        windowSeconds: 35,
        minimumReadings: 5,
        recoveryWindowSeconds: 25,
        recoveryPersistenceSeconds: 15,

        high: { threshold: 70, recoveryThreshold: 65 },
        low: { threshold: 20, recoveryThreshold: 25 }
    },

    radiation_dose_rate: {
        unit: "µSv/h",
        persistenceSeconds: 20,
        windowSeconds: 35,
        minimumReadings: 5,
        recoveryWindowSeconds: 25,
        recoveryPersistenceSeconds: 15,

        high: { threshold: 1.0, recoveryThreshold: 0.8 }
    }

};


// =========================================
// GET RECENT SENSOR STATISTICS
// =========================================

function getRecentReadings(crewId, metric, windowSeconds) {

    return db.prepare(`
        SELECT
            COUNT(*) AS total,
            MIN(value) AS minimum,
            MAX(value) AS maximum,
            MIN(recorded_at) AS first_reading,
            MAX(recorded_at) AS last_reading
        FROM sensor_readings
        WHERE crew_id = ?
        AND metric = ?
        AND recorded_at >= datetime('now', ?)
    `).get(
        crewId,
        metric,
        `-${windowSeconds} seconds`
    );

}


// =========================================
// CALCULATE PERSISTENCE DURATION
// =========================================

function getPersistenceDuration(recent) {

    if (!recent.first_reading || !recent.last_reading) {
        return 0;
    }

    const result = db.prepare(`
        SELECT
            (julianday(?) - julianday(?)) * 86400 AS seconds
    `).get(
        recent.last_reading,
        recent.first_reading
    );

    return result.seconds || 0;

}


// =========================================
// CHECK WHETHER AN ANOMALY IS PRESENT
// =========================================

function isAnomaly(recent, direction, threshold) {

    if (direction === "high") {
        return recent.minimum > threshold;
    }

    if (direction === "low") {
        return recent.maximum < threshold;
    }

    return false;

}


// =========================================
// CHECK WHETHER READINGS HAVE RECOVERED
// =========================================

function hasRecovered(recent, direction, recoveryThreshold) {

    if (direction === "high") {
        return recent.maximum <= recoveryThreshold;
    }

    if (direction === "low") {
        return recent.minimum >= recoveryThreshold;
    }

    return false;

}


// =========================================
// CREATE AN ASTRA ALERT
// =========================================

function createAlert(crewId, metric, direction, rule, recent) {

    const alertType =
        `${metric}_${direction}_persistent_anomaly`;

    let astraResponse = null;

    try {

        const question =
            `What does a persistent ${direction} ${metric.replace("_", " ")} anomaly mean in a spaceflight context, and what research guidance is available?`;

        astraResponse = buildKnowledgeAnswer(question);

    } catch (error) {

        console.error(
            "ASTRA response generation error:",
            error
        );

    }

    const message =
        `Persistent ${direction} ${metric.replace("_", " ")} anomaly detected. ` +
        `Observed range: ${recent.minimum}–${recent.maximum} ${rule.unit}. ` +
        `Investigation recommended.`;

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
        message,
        astraResponse ? JSON.stringify(astraResponse) : null
    );

    console.log(
        `ASTRA alert created: Crew ${crewId}, ${alertType}`
    );

    return result.lastInsertRowid;

}


// =========================================
// RESOLVE A RECOVERED ALERT
// =========================================

function resolveAlert(alertId) {

    db.prepare(`
        UPDATE alerts
        SET
            status = 'resolved',
            resolved_at = CURRENT_TIMESTAMP
        WHERE id = ?
        AND status IN ('open', 'acknowledged')
    `).run(alertId);

    console.log(
        `ASTRA alert ${alertId} resolved after recovery.`
    );

}


// =========================================
// MAIN ANOMALY EVALUATION
// =========================================

function evaluateReading(crewId, metric) {

    const rule = alertRules[metric];

    if (!rule) {
        return null;
    }

    for (const direction of ["high", "low"]) {

        const directionRule = rule[direction];

        if (!directionRule) {
            continue;
        }

        const alertType =
            `${metric}_${direction}_persistent_anomaly`;

        // Check for an existing unresolved alert.
        const existingAlert = db.prepare(`
            SELECT id
            FROM alerts
            WHERE crew_id = ?
            AND alert_type = ?
            AND status IN ('open', 'acknowledged')
        `).get(
            crewId,
            alertType
        );


        // =====================================
        // EXISTING ALERT: CHECK FOR RECOVERY
        // =====================================

        if (existingAlert) {

            const recoveryReadings = getRecentReadings(
                crewId,
                metric,
                rule.recoveryWindowSeconds
            );

            const recoveryDuration =
                getPersistenceDuration(recoveryReadings);

            const enoughReadings =
                recoveryReadings.total >= rule.minimumReadings;

            const recoveryPersisted =
                recoveryDuration >= rule.recoveryPersistenceSeconds;

            const recovered = hasRecovered(
                recoveryReadings,
                direction,
                directionRule.recoveryThreshold
            );

            if (
                enoughReadings &&
                recoveryPersisted &&
                recovered
            ) {

                resolveAlert(existingAlert.id);

            }

            // Prevent duplicate alerts while one is active.
            continue;

        }


        // =====================================
        // NO EXISTING ALERT: CHECK FOR ANOMALY
        // =====================================

        const recent = getRecentReadings(
            crewId,
            metric,
            rule.windowSeconds
        );

        if (recent.total < rule.minimumReadings) {
            continue;
        }

        const duration = getPersistenceDuration(recent);

        if (duration < rule.persistenceSeconds) {
            continue;
        }

        const anomalyDetected = isAnomaly(
            recent,
            direction,
            directionRule.threshold
        );

        if (!anomalyDetected) {
            continue;
        }

        return createAlert(
            crewId,
            metric,
            direction,
            rule,
            recent
        );

    }

    return null;

}


// =========================================
// EXPORT SERVICE
// =========================================

module.exports = {
    evaluateReading
};
