const cors = require("cors");
const express = require("express");
const db = require("./database/connection");
const alertRoutes = require("./routes/alertRoutes");
const knowledgeRoutes = require("./routes/knowledgeRoutes");
const healthReportRoutes = require("./routes/healthReportRoutes");

require("./database/initDatabase");

const readingRoutes = require("./routes/readingRoutes");

const crewRoutes = require("./routes/crewRoutes");

const app = express();
const PORT = 3000;

// Middleware
app.use(cors({
    origin: [
        "http://127.0.0.1:5500",
        "http://localhost:5500"
    ]
}));

app.use(express.json());


// API ROUTES
app.use("/api/knowledge", knowledgeRoutes);

app.use("/api/crew", crewRoutes);

app.use("/api/readings", readingRoutes);

app.use("/api/alerts", alertRoutes);

app.use("/api/health-reports", healthReportRoutes);

app.get("/", (req, res) => {
    res.send("ASTRA V2 API is running!");
});

app.listen(PORT, () => {
    console.log(`ASTRA V2 server running on port ${PORT}`);
});