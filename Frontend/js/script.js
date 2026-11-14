
// =====================================
// ASTRA V2 - DASHBOARD CONNECTION
// =====================================

const API_URL = "http://localhost:3000/api";

// Select astronaut using URL parameter.
// Example: index.html?astronaut=1

const params = new URLSearchParams(window.location.search);

const astronautId = Number(params.get("astronaut")) || 1;


// =====================================
// LOAD CREW MEMBERS
// =====================================

async function loadCrew() {

    try {

        const response = await fetch(`${API_URL}/crew`);

        if (!response.ok) {
            throw new Error("Could not retrieve crew members.");
        }

        const crew = await response.json();

        const astronaut = crew.find(
            member => member.id === astronautId
        );

        if (!astronaut) {
            throw new Error("Astronaut not found.");
        }

        document.getElementById("astronaut-name").textContent =
            astronaut.name;

        document.getElementById("crew-code").textContent =
            astronaut.crew_code;

        document.getElementById("astronaut-role").textContent =
            astronaut.role;

        renderCrew(crew);

    } catch (error) {

        console.error("Crew loading error:", error);

    }

}


// =====================================
// DISPLAY CREW MEMBERS
// =====================================

function renderCrew(crew) {

    const container = document.getElementById("crew-container");

    container.innerHTML = "";

    crew.forEach(member => {

        const crewMember = document.createElement("div");

        crewMember.className = "crew-member";

        crewMember.innerHTML = `
            <div>
                <strong>${member.name}</strong>
                <p>${member.crew_code}</p>
            </div>
            <span>CREW MEMBER</span>
        `;

        container.appendChild(crewMember);

    });

}


// =====================================
// LOAD ASTRONAUT READINGS
// =====================================

async function loadReadings() {

    try {

        const response = await fetch(
            `${API_URL}/readings?crew_id=${astronautId}`
        );

        if (!response.ok) {
            throw new Error("Could not retrieve readings.");
        }

        const readings = await response.json();

        if (readings.length === 0) {
            return;
        }

        // Find the latest reading for each metric.
        const latestReadings = {};

        readings.forEach(reading => {

            if (!latestReadings[reading.metric]) {
                latestReadings[reading.metric] = reading;
            }

        });

        // Update heart rate.
        if (latestReadings.heart_rate) {

            document.getElementById("heart-rate").textContent =
                Number(latestReadings.heart_rate.value).toFixed(1);

        }

        // Update oxygen saturation.
        if (latestReadings.oxygen_saturation) {

            document.getElementById("oxygen").textContent =
                Number(latestReadings.oxygen_saturation.value).toFixed(1);

        }

        // Update body temperature.
        if (latestReadings.body_temperature) {

            document.getElementById("temperature").textContent =
                Number(latestReadings.body_temperature.value).toFixed(1);

        }

        // Display latest reading timestamp.
        const timestamps = Object.values(latestReadings)
            .map(reading => new Date(
                reading.recorded_at.replace(" ", "T") + "Z"
            ).getTime());

        const latestTimestamp = new Date(Math.max(...timestamps));

        document.getElementById("last-updated").textContent =
            latestTimestamp.toLocaleTimeString();

        document.getElementById("sensor-status").textContent =
            "Receiving data";

        document.getElementById("health-status").textContent =
            "Data available";

    } catch (error) {

        console.error("Reading loading error:", error);

        document.getElementById("sensor-status").textContent =
            "Connection error";

    }

}


// =====================================
// LOAD ALERTS
// =====================================

async function loadAlerts() {

    try {

        const response = await fetch(`${API_URL}/alerts`);

        if (!response.ok) {
            throw new Error("Could not retrieve alerts.");
        }

        const alerts = await response.json();

        // Only show alerts for the selected astronaut
        // that have not been resolved.

        const activeAlerts = alerts.filter(alert =>
            alert.status !== "resolved" &&
            alert.crew_code === `ASTRA-${String(astronautId).padStart(3, "0")}`
        );

        document.getElementById("alert-count").textContent =
            activeAlerts.length;

        const container =
            document.getElementById("alerts-container");

        container.innerHTML = "";

        if (activeAlerts.length === 0) {

            container.innerHTML =
                '<p class="empty-state">No active alerts.</p>';

            return;

        }

        activeAlerts.forEach(alert => {

            const alertElement = document.createElement("div");

            alertElement.className =
                `alert-item ${alert.severity}`;

            const heading = document.createElement("strong");
            heading.textContent = alert.severity.toUpperCase();

            const message = document.createElement("p");
            message.textContent = alert.message;

            const timestamp = document.createElement("small");
            timestamp.textContent = alert.triggered_at;

            alertElement.appendChild(heading);
            alertElement.appendChild(message);
            alertElement.appendChild(timestamp);

            container.appendChild(alertElement);

        });

    } catch (error) {

        console.error("Alert loading error:", error);

    }

}


// =====================================
// REFRESH DASHBOARD
// =====================================

async function refreshDashboard() {

    await Promise.all([
        loadCrew(),
        loadReadings(),
        loadAlerts()
    ]);

}


// Initial dashboard load.
refreshDashboard();


// Refresh data every five seconds.
setInterval(refreshDashboard, 5000);
