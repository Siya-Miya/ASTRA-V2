const express = require("express");
const router = express.Router();

const db = require("../database/connection");

// =========================================
// GET: RETRIEVE ALERTS
// =========================================

router.get("/", (req, res) => {
    try {
        const alerts = db.prepare(`
            SELECT
                alerts.id,
                alerts.crew_id,
                crew_members.name AS astronaut,
                crew_members.crew_code,
                alerts.alert_type,
                alerts.severity,
                alerts.message,
                alerts.status,
                alerts.triggered_at,
                alerts.acknowledged_at,
                alerts.resolved_at,
                alerts.astra_response_json
            FROM alerts
            JOIN crew_members
                ON alerts.crew_id = crew_members.id
            ORDER BY
                alerts.triggered_at DESC,
                alerts.id DESC
            LIMIT 100
        `).all();

        res.json({
            success: true,
            count: alerts.length,
            data: alerts
        });

    } catch (error) {
        console.error("Error retrieving alerts:", error);

        res.status(500).json({
            success: false,
            error: "Could not retrieve alerts."
        });
    }
});

// =========================================
// PATCH: ACKNOWLEDGE AN ALERT
// =========================================

router.patch("/:id/acknowledge", (req, res) => {
    try {
        const alertId = Number(req.params.id);

        if (!Number.isInteger(alertId) || alertId < 1) {
            return res.status(400).json({
                success: false,
                error: "Invalid alert ID."
            });
        }

        const result = db.prepare(`
            UPDATE alerts
            SET
                status = 'acknowledged',
                acknowledged_at = CURRENT_TIMESTAMP
            WHERE id = ?
            AND status = 'open'
        `).run(alertId);

        if (result.changes === 0) {
            const existingAlert = db.prepare(`
                SELECT id, status
                FROM alerts
                WHERE id = ?
            `).get(alertId);

            if (!existingAlert) {
                return res.status(404).json({
                    success: false,
                    error: "Alert not found."
                });
            }

            return res.status(409).json({
                success: false,
                error: "Only open alerts can be acknowledged.",
                current_status: existingAlert.status
            });
        }

        const acknowledgedAlert = db.prepare(`
            SELECT
                id,
                crew_id,
                alert_type,
                severity,
                message,
                status,
                triggered_at,
                acknowledged_at,
                resolved_at
            FROM alerts
            WHERE id = ?
        `).get(alertId);

        return res.json({
            success: true,
            message: "Alert acknowledged successfully.",
            data: acknowledgedAlert
        });

    } catch (error) {
        console.error("Error acknowledging alert:", error);

        res.status(500).json({
            success: false,
            error: "Could not acknowledge alert."
        });
    }
});

module.exports = router;