const express = require("express");
const router = express.Router();

const db = require("../database/connection");
const { buildKnowledgeAnswer } = require("../services/knowledgeAnswer");

// POST: Save health report and create alert
router.post("/", (req, res) => {
    try {
        const {
            crew_id,
            body_region,
            description,
            severity,
            onset,
            notes
        } = req.body;

        if (
            !Number.isInteger(Number(crew_id)) ||
            Number(crew_id) < 1 ||
            typeof description !== "string" ||
            description.trim().length === 0
        ) {
            return res.status(400).json({
                success: false,
                message: "A valid crew ID and symptom description are required."
            });
        }

        const severityMap = {
            mild: "info",
            moderate: "warning",
            severe: "critical"
        };

        if (!severityMap[severity]) {
            return res.status(400).json({
                success: false,
                message: "Select a valid symptom severity."
            });
        }

        const crewId = Number(crew_id);

        const crewMember = db.prepare(`
            SELECT id, name, crew_code
            FROM crew_members
            WHERE id = ?
        `).get(crewId);

        if (!crewMember) {
            return res.status(404).json({
                success: false,
                message: "Astronaut not found."
            });
        }

        const symptoms = {
            description: description.trim(),
            severity,
            onset: onset || "Not specified"
        };

        let astraResponse = null;

        try {
            const question = `
                An astronaut has reported the following symptom:

                Body region: ${body_region || "Not specified"}
                Symptom: ${symptoms.description}
                Reported severity: ${symptoms.severity}
                Onset: ${symptoms.onset}

                What relevant spaceflight health research,
                warning signs and escalation guidance are available?
            `;

            astraResponse = buildKnowledgeAnswer(question);
        } catch (error) {
            console.error("Health report knowledge error:", error);
        }

        const astraResponseJson = astraResponse
            ? JSON.stringify(astraResponse)
            : null;

        // Save the report and its alert together.
        const saveReportAndAlert = db.transaction(() => {
            const reportResult = db.prepare(`
                INSERT INTO health_reports (
                    crew_id,
                    body_region,
                    symptoms_json,
                    notes,
                    astra_response_json
                )
                VALUES (?, ?, ?, ?, ?)
            `).run(
                crewId,
                body_region || null,
                JSON.stringify(symptoms),
                notes || null,
                astraResponseJson
            );

            const reportId = reportResult.lastInsertRowid;

            const alertResult = db.prepare(`
                INSERT INTO alerts (
                    crew_id,
                    report_id,
                    alert_type,
                    severity,
                    message,
                    status,
                    astra_response_json
                )
                VALUES (?, ?, ?, ?, ?, 'open', ?)
            `).run(
                crewId,
                reportId,
                "symptom_report",
                severityMap[severity],
                `${crewMember.name} reported ${symptoms.description} in ${body_region || "an unspecified region"}.`,
                astraResponseJson
            );

            const report = db.prepare(`
                SELECT *
                FROM health_reports
                WHERE id = ?
            `).get(reportId);

            const alert = db.prepare(`
                SELECT *
                FROM alerts
                WHERE id = ?
            `).get(alertResult.lastInsertRowid);

            return { report, alert };
        });

        const saved = saveReportAndAlert();

        return res.status(201).json({
            success: true,
            message: "Health report and alert saved successfully.",
            data: {
                report: saved.report,
                alert: saved.alert,
                astra_response: astraResponse
            }
        });

    } catch (error) {
        console.error("Health report error:", error);

        return res.status(500).json({
            success: false,
            message: "Could not save the health report."
        });
    }
});

module.exports = router;