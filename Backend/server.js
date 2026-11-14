const cors = require("cors");
const express = require("express");
const db = require("./database/connection");
const alertRoutes = require("./routes/alertRoutes");

require("./database/initDatabase");

const readingRoutes = require("./routes/readingRoutes");

const crewRoutes = require("./routes/crewRoutes");

const app = express();
const PORT = 3000;

app.use(express.json());


app.use(cors());

app.use("/api/crew", crewRoutes);

app.use("/api/readings", readingRoutes);

app.use("/api/alerts", alertRoutes);

app.get("/", (req, res) => {
    res.send("ASTRA V2 API is running!");
});

app.listen(PORT, () => {
    console.log(`ASTRA V2 server running on port ${PORT}`);
});