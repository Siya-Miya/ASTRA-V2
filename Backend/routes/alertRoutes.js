const express = require("express");
const router = express.Router();

const db = require("../database/connection");

// GET: Retrieve alerts
router.get("/", (req, res) => {

    try {

        const alerts = db.prepare(`
            SELECT
                alerts.id,
                crew_members.name AS astronaut,
                crew_members.crew_code,
                alerts.alert_type,
                alerts.severity,
                alerts.message,
                alerts.status,
                alerts.triggered_at
            FROM alerts
            JOIN crew_members
                ON alerts.crew_id = crew_members.id
            ORDER BY alerts.triggered_at DESC, alerts.id DESC
            LIMIT 100
        `).all();

        res.json(alerts);

    } catch (error) {

        console.error("Error retrieving alerts:", error);

        res.status(500).json({
            error: "Could not retrieve alerts."
        });

    }

});

module.exports = router;
