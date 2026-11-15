const express = require("express");
const router = express.Router();

const db = require("../database/connection");

const { evaluateReading } = require("../services/alertService");

// =========================================
// POST: SAVE A SENSOR READING
// =========================================

router.post("/", (req, res) => {

    try {

        const { crew_id, metric, value, unit, source } = req.body;

        // Validate required fields
        if (
            !Number.isInteger(crew_id) ||
            !metric ||
            typeof value !== "number" ||
            !unit
        ) {

            return res.status(400).json({
                error: "Invalid sensor reading data."
            });

        }

        // Save reading in database
        const result = db.prepare(`
            INSERT INTO sensor_readings
            (crew_id, metric, value, unit, source)
            VALUES (?, ?, ?, ?, ?)
        `).run(
            crew_id,
            metric,
            value,
            unit,
            source || "simulator"
        );

        // Evaluate the new reading for persistent anomalies
        const alertId = evaluateReading(crew_id, metric);

        res.status(201).json({
            message: "Sensor reading saved successfully.",
            reading_id: result.lastInsertRowid,
            alert_id: alertId
        });

    } catch (error) {

        console.error("Error saving reading:", error);

        res.status(500).json({
            error: "Could not save sensor reading."
        });

    }

});


// =========================================
// GET: RETRIEVE SENSOR READINGS
// =========================================

router.get("/", (req, res) => {

    try {

        const crewId = req.query.crew_id;

        let readings;

        if (crewId !== undefined) {

            const id = Number(crewId);

            if (!Number.isInteger(id) || id < 1) {
                return res.status(400).json({
                    error: "Invalid crew ID."
                });
            }

            readings = db.prepare(`
                SELECT *
                FROM sensor_readings
                WHERE crew_id = ?
                ORDER BY recorded_at DESC, id DESC
                LIMIT 100
            `).all(id);

        } else {

            readings = db.prepare(`
                SELECT *
                FROM sensor_readings
                ORDER BY recorded_at DESC, id DESC
                LIMIT 100
            `).all();

        }

        res.json(readings);

    } catch (error) {

        console.error("Error retrieving readings:", error);

        res.status(500).json({
            error: "Could not retrieve sensor readings."
        });

    }

});

module.exports = router;