
const express = require("express");
const router = express.Router();

const { buildKnowledgeAnswer } = require("../services/knowledgeAnswer");

// POST: Ask ASTRA a knowledge-base question
router.post("/ask", (req, res) => {

    try {
        const { question } = req.body;

        if (
            typeof question !== "string" ||
            question.trim().length === 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Please provide a question."
            });
        }

        if (question.length > 500) {
            return res.status(400).json({
                success: false,
                message: "Question must be 500 characters or fewer."
            });
        }

        const answer = buildKnowledgeAnswer(question.trim());

        return res.status(200).json({
            success: true,
            data: answer
        });

    } catch (error) {
        console.error("Knowledge route error:", error);

        return res.status(500).json({
            success: false,
            message: "ASTRA could not process the question."
        });
    }
});

module.exports = router;
