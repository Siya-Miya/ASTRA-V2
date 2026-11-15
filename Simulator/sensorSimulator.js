
// =========================================
// ASTRA V2 — CENTRAL SENSOR SIMULATOR
// =========================================

const API_URL = "http://localhost:3000/api/readings";

// Five astronauts
const crew = [
    { id: 1, name: "Commander One" },
    { id: 2, name: "Crew Member Two" },
    { id: 3, name: "Crew Member Three" },
    { id: 4, name: "Crew Member Four" },
    { id: 5, name: "Crew Member Five" }
];

// Simulated sensor baselines
const sensorBaselines = {

    // Crew physiology
    heart_rate: {
        value: 75,
        variation: 8,
        unit: "bpm"
    },

    oxygen_saturation: {
        value: 98,
        variation: 1,
        unit: "%"
    },

    body_temperature: {
        value: 36.8,
        variation: 0.3,
        unit: "°C"
    },

    respiratory_rate: {
        value: 16,
        variation: 2,
        unit: "breaths/min"
    },

    // Spacecraft environment
    cabin_temperature: {
        value: 22,
        variation: 1,
        unit: "°C"
    },

    cabin_pressure: {
        value: 101.3,
        variation: 0.5,
        unit: "kPa"
    },

    cabin_oxygen: {
        value: 21,
        variation: 0.3,
        unit: "%"
    },

    carbon_dioxide: {
        value: 0.1,
        variation: 0.02,
        unit: "%"
    },

    humidity: {
        value: 45,
        variation: 3,
        unit: "%"
    },

    // Radiation monitoring
    radiation_dose_rate: {
        value: 0.3,
        variation: 0.05,
        unit: "µSv/h"
    }

};


// Generate a random reading
function generateReading(baseline) {

    const variation =
        (Math.random() * 2 - 1) * baseline.variation;

    return Number(
        (baseline.value + variation).toFixed(2)
    );

}


// Send one reading to the backend
async function sendReading(crewMember, metric, sensor) {

    const value = generateReading(sensor);

    const reading = {
        crew_id: crewMember.id,
        metric: metric,
        value: value,
        unit: sensor.unit,
        source: "central_simulator"
    };

    try {

        const response = await fetch(API_URL, {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify(reading)
        });

        if (!response.ok) {

            const error = await response.json();

            console.error("API error:", error);

            return false;
        }

        return true;

    } catch (error) {

        console.error("Could not reach ASTRA API:", error.message);

        return false;
    }

}


// Send readings for every astronaut
async function simulateSensors() {

    console.log("\nGenerating simulated crew and environment readings...\n");

    for (const member of crew) {

        for (const metric in sensorBaselines) {

            const sensor = sensorBaselines[metric];

            await sendReading(member, metric, sensor);

        }

        console.log(`10 simulated readings generated for ${member.name}`);

    }

    console.log("\nSimulation cycle complete.");

}


// Run continuously every five seconds
async function startSimulator() {

    console.log("ASTRA V2 Central Simulator started.");
    console.log("Monitoring 10 simulated metrics for 5 crew members.");

    while (true) {

        await simulateSensors();

        await new Promise(resolve => setTimeout(resolve, 5000));

    }

}


startSimulator();
