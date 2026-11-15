
const express = require("express");
const router = express.Router();

const db = require("../database/connection");
const { buildKnowledgeAnswer } = require("../services/knowledgeAnswer");

// =====================================
// POST: SUBMIT A HEALTH REPORT
// =====================================

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

        // Validate required information.
        if (
            !Number.isInteger(Number(crew_id)) ||
            typeof description !== "string" ||
            description.trim().length === 0
        ) {

            return res.status(400).json({
                success: false,
                message: "A valid crew ID and symptom description are required."
            });

        }

        const crewId = Number(crew_id);

        // Confirm that the astronaut exists.
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

        // Keep the report details together.
        const symptoms = {
            description: description.trim(),
            severity: severity || "Not specified",
            onset: onset || "Not specified"
        };

        // Ask ASTRA to search its research database.
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

        // Save the report and ASTRA's response.
        const result = db.prepare(`
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
            astraResponse ? JSON.stringify(astraResponse) : null
        );

        // Retrieve the saved report.
        const report = db.prepare(`
            SELECT *
            FROM health_reports
            WHERE id = ?
        `).get(result.lastInsertRowid);

        return res.status(201).json({
            success: true,
            message: "Health report saved successfully.",
            data: {
                report,
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
