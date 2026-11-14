const express = require("express");
const router = express.Router();

const db = require("../database/connection");

// GET all crew members
router.get("/", (req, res) => {

    try {

        const crew = db.prepare(`
            SELECT
                id,
                crew_code,
                name,
                role
            FROM crew_members
            ORDER BY id
        `).all();

        res.json(crew);

    } catch (error) {

        console.error("Error retrieving crew:", error);

        res.status(500).json({
            error: "Could not retrieve crew members."
        });

    }

});

module.exports = router;