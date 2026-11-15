const express = require("express");
const router = express.Router();

const db = require("../database/connection");

// GET: Retrieve health event history
router.get("/", (req, res) => {
    try {
        const crewId = req.query.crew_id;
        const bodyRegion = req.query.body_region;

        let query = `
            SELECT *
            FROM (
                SELECT
                    id,
                    crew_id,
                    'sensor_alert' AS event_type,
                    'General' AS body_region,
                    alert_type AS title,
                    message AS description,
                    severity,
                    status,
                    triggered_at AS occurred_at,
                    acknowledged_at,
                    resolved_at,
                    astra_response_json
                FROM alerts
                WHERE report_id IS NULL

                UNION ALL

                SELECT
                    id,
                    crew_id,
                    'symptom_report' AS event_type,
                    COALESCE(body_region, 'General') AS body_region,
                    'Astronaut symptom report' AS title,
                    symptoms_json AS description,
                    json_extract(symptoms_json, '$.severity') AS severity,
                    status,
                    reported_at AS occurred_at,
                    NULL AS acknowledged_at,
                    NULL AS resolved_at,
                    astra_response_json
                FROM health_reports
            ) AS events
        `;

        const conditions = [];
        const values = [];

        if (crewId !== undefined) {
            if (
                !Number.isInteger(Number(crewId)) ||
                Number(crewId) < 1
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid crew ID."
                });
            }

            conditions.push("crew_id = ?");
            values.push(Number(crewId));
        }

        if (bodyRegion) {
            conditions.push("LOWER(body_region) = LOWER(?)");
            values.push(bodyRegion);
        }

        if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(" AND ")}`;
        }

        query += " ORDER BY occurred_at DESC";

        const events = db.prepare(query).all(...values);

        return res.status(200).json({
            success: true,
            count: events.length,
            data: events
        });

    } catch (error) {
        console.error("Health event history error:", error);

        return res.status(500).json({
            success: false,
            message: "Could not retrieve health event history."
        });
    }
});

module.exports = router;