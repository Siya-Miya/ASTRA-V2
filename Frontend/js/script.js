
import * as THREE from "three";

import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";


// =====================================
// ASTRA V2 - CONFIGURATION
// =====================================

const API_URL = "http://localhost:3000/api";

const params = new URLSearchParams(window.location.search);

const astronautId = Number(params.get("astronaut")) || 1;

// Change to "female" to use the other available anatomy model.
const bodyType = params.get("body") === "female" ? "female" : "male";

const MODEL_URL =
    `https://cdn.jsdelivr.net/npm/open-anatomy-3d@0.1.0/models/anatomy-${bodyType}.glb`;


// =====================================
// THREE.JS VARIABLES
// =====================================

const canvas = document.getElementById("body-canvas");

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
    35,
    1,
    0.1,
    100
);

camera.position.set(0, 1.7, 5.5);

const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    alpha: true
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

renderer.outputColorSpace = THREE.SRGBColorSpace;

renderer.toneMapping = THREE.ACESFilmicToneMapping;

renderer.toneMappingExposure = 1.2;


// =====================================
// LIGHTING
// =====================================

const ambientLight = new THREE.HemisphereLight(
    0xdceeff,
    0x15243a,
    2.2
);

scene.add(ambientLight);


const mainLight = new THREE.DirectionalLight(
    0xffffff,
    3
);

mainLight.position.set(3, 5, 5);

scene.add(mainLight);


const blueLight = new THREE.PointLight(
    0x398bff,
    25,
    10
);

blueLight.position.set(-3, 2, 2);

scene.add(blueLight);


const backLight = new THREE.DirectionalLight(
    0x55d6e8,
    2
);

backLight.position.set(0, 3, -4);

scene.add(backLight);


// =====================================
// CAMERA CONTROLS
// =====================================

const controls = new OrbitControls(camera, canvas);

controls.enableDamping = true;

controls.dampingFactor = 0.06;

controls.enablePan = false;

controls.minDistance = 2.5;

controls.maxDistance = 9;

controls.target.set(0, 1.5, 0);


// =====================================
// LOAD ANATOMICAL MODEL
// =====================================

let anatomicalModel = null;

let modelBounds = null;

let selectedObject = null;

let originalMaterial = null;

let selectedRegionName = null;

const loader = new GLTFLoader();

loader.setMeshoptDecoder(MeshoptDecoder);


async function loadAnatomicalModel() {

    const loadingScreen = document.getElementById("model-loading");

    const modelStatus = document.getElementById("model-status");

    try {

        modelStatus.textContent = "DOWNLOADING ANATOMY";

        const gltf = await loader.loadAsync(MODEL_URL);

        anatomicalModel = gltf.scene;

        // Add the model to the scene.
        scene.add(anatomicalModel);

        // Find the model's dimensions.
        const initialBounds = new THREE.Box3().setFromObject(
            anatomicalModel
        );

        const size = initialBounds.getSize(new THREE.Vector3());

        const center = initialBounds.getCenter(new THREE.Vector3());

        // Centre the model horizontally.
        anatomicalModel.position.x = -center.x;

        anatomicalModel.position.z = -center.z;

        anatomicalModel.position.y = -initialBounds.min.y;

        // Scale the model to fit the viewer.
        const targetHeight = 3.2;

        const scale = targetHeight / size.y;

        anatomicalModel.scale.setScalar(scale);

        // Make the outer skin translucent so internal anatomy
        // can be explored.
        const skin = anatomicalModel.getObjectByName("skin");

        if (skin) {

            skin.traverse(object => {

                if (!object.isMesh) return;

                object.material = object.material.clone();

                object.material.transparent = true;

                object.material.opacity = 0.14;

                object.material.depthWrite = false;

            });

        }

        anatomicalModel.traverse(object => {

            if (!object.isMesh) return;

            object.frustumCulled = true;

        });

        modelBounds = new THREE.Box3().setFromObject(
            anatomicalModel
        );

        // Set the camera target to the model's centre.
        const modelCenter = modelBounds.getCenter(
            new THREE.Vector3()
        );

        controls.target.copy(modelCenter);

        camera.position.set(
            modelCenter.x,
            modelCenter.y + 0.1,
            modelCenter.z + 5.5
        );

        controls.update();

        loadingScreen.classList.add("hidden");

        modelStatus.textContent = "ANATOMY MODEL ONLINE";

        console.log("ASTRA anatomical model loaded.");

    } catch (error) {

        console.error("Anatomical model loading error:", error);

        modelStatus.textContent = "MODEL UNAVAILABLE";

        loadingScreen.innerHTML = `
            <p>Unable to load anatomical model.</p>
            <p>Check your internet connection and refresh.</p>
        `;

    }

}


// =====================================
// RESIZE THE 3D VIEWER
// =====================================

function resizeViewer() {

    const width = canvas.clientWidth;

    const height = canvas.clientHeight;

    if (!width || !height) return;

    camera.aspect = width / height;

    camera.updateProjectionMatrix();

    renderer.setSize(width, height, false);

}

const resizeObserver = new ResizeObserver(resizeViewer);

resizeObserver.observe(canvas.parentElement);

resizeViewer();


// =====================================
// ANIMATION LOOP
// =====================================

let autoRotate = false;

function animate() {

    requestAnimationFrame(animate);

    if (autoRotate && anatomicalModel) {

        anatomicalModel.rotation.y += 0.003;

    }

    controls.update();

    renderer.render(scene, camera);

}

animate();


// =====================================
// BODY REGION SELECTION
// =====================================

const raycaster = new THREE.Raycaster();

const pointer = new THREE.Vector2();

let pointerStartX = 0;

let pointerStartY = 0;


function identifyBodyRegion(point) {

    if (!modelBounds) return "General";

    const size = modelBounds.getSize(new THREE.Vector3());

    const center = modelBounds.getCenter(new THREE.Vector3());

    const normalizedY = (point.y - modelBounds.min.y) / size.y;

    const normalizedX = Math.abs(point.x - center.x) / size.x;

    // Arms are identified by their horizontal position.
    if (normalizedX > 0.27 && normalizedY > 0.2 && normalizedY < 0.82) {
        return "Arms";
    }

    if (normalizedY > 0.84) return "Head";

    if (normalizedY > 0.76) return "Neck";

    if (normalizedY > 0.53) return "Chest";

    if (normalizedY > 0.38) return "Abdomen";

    if (normalizedY > 0.25) return "Pelvis";

    return "Legs";

}


function selectBodyRegion(region) {

    selectedRegionName = region;

    document.getElementById("selected-region").textContent =
        `${region} selected`;

    document.getElementById("symptom-region").value =
        region;

    document.getElementById("report-region-button").disabled =
        false;

}


canvas.addEventListener("pointerdown", event => {

    pointerStartX = event.clientX;

    pointerStartY = event.clientY;

});


canvas.addEventListener("pointerup", event => {

    // Ignore movements because they are camera rotation.
    const movement = Math.hypot(
        event.clientX - pointerStartX,
        event.clientY - pointerStartY
    );

    if (movement > 5 || !anatomicalModel) return;

    const rect = canvas.getBoundingClientRect();

    pointer.x = (
        (event.clientX - rect.left) / rect.width
    ) * 2 - 1;

    pointer.y = -(
        (event.clientY - rect.top) / rect.height
    ) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);

    const intersections = raycaster.intersectObject(
        anatomicalModel,
        true
    );

    if (intersections.length === 0) return;

    const region = identifyBodyRegion(
        intersections[0].point
    );

    selectBodyRegion(region);

});


// =====================================
// VIEWER BUTTONS
// =====================================

document.getElementById("rotate-button").addEventListener(
    "click",
    () => {

        autoRotate = !autoRotate;

        document.getElementById("rotate-button").textContent =
            autoRotate ? "STOP ROTATION" : "ROTATE";

    }
);


document.getElementById("reset-view-button").addEventListener(
    "click",
    () => {

        if (!modelBounds) return;

        anatomicalModel.rotation.set(0, 0, 0);

        autoRotate = false;

        document.getElementById("rotate-button").textContent =
            "ROTATE";

        const center = modelBounds.getCenter(
            new THREE.Vector3()
        );

        camera.position.set(
            center.x,
            center.y + 0.1,
            center.z + 5.5
        );

        controls.target.copy(center);

        controls.update();

    }
);


document.getElementById("report-region-button").addEventListener(
    "click",
    () => {

        document.getElementById("report-section").scrollIntoView({
            behavior: "smooth"
        });

        document.getElementById("symptom-description").focus();

    }
);


// =====================================
// LOAD CREW
// =====================================

async function loadCrew() {

    try {

        const response = await fetch(`${API_URL}/crew`);

        if (!response.ok) {
            throw new Error("Could not retrieve crew.");
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

    } catch (error) {

        console.error("Crew loading error:", error);

    }

}


// =====================================
// LOAD VITAL READINGS
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

        if (readings.length === 0) return;

        const latest = {};

        readings.forEach(reading => {

            if (!latest[reading.metric]) {
                latest[reading.metric] = reading;
            }

        });

        if (latest.heart_rate) {

            document.getElementById("heart-rate").textContent =
                Number(latest.heart_rate.value).toFixed(1);

        }

        if (latest.oxygen_saturation) {

            document.getElementById("oxygen").textContent =
                Number(latest.oxygen_saturation.value).toFixed(1);

        }

        if (latest.body_temperature) {

            document.getElementById("temperature").textContent =
                Number(latest.body_temperature.value).toFixed(1);

        }

        const timestamps = Object.values(latest).map(reading =>
            new Date(
                reading.recorded_at.replace(" ", "T") + "Z"
            ).getTime()
        );

        document.getElementById("last-updated").textContent =
            new Date(Math.max(...timestamps)).toLocaleTimeString();

        document.getElementById("sensor-status").textContent =
            "RECEIVING SENSOR DATA";

        document.getElementById("health-status").textContent =
            "DATA AVAILABLE";

    } catch (error) {

        console.error("Reading loading error:", error);

        document.getElementById("sensor-status").textContent =
            "CONNECTION ERROR";

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

        const crewCode =
            `ASTRA-${String(astronautId).padStart(3, "0")}`;

        const activeAlerts = alerts.filter(alert =>
            alert.crew_code === crewCode &&
            alert.status !== "resolved"
        );

        document.getElementById("alert-count").textContent =
            activeAlerts.length;

        const container =
            document.getElementById("alerts-container");

        container.innerHTML = "";

        if (activeAlerts.length === 0) {

            container.innerHTML =
                '<p class="empty-state">No active notifications.</p>';

            return;

        }

        activeAlerts.forEach(alert => {

            const item = document.createElement("div");

            item.className = `alert-item ${alert.severity}`;

            const heading = document.createElement("strong");

            heading.textContent = alert.severity.toUpperCase();

            const message = document.createElement("p");

            message.textContent = alert.message;

            const timestamp = document.createElement("small");

            timestamp.textContent = alert.triggered_at;

            item.appendChild(heading);

            item.appendChild(message);

            item.appendChild(timestamp);

            container.appendChild(item);

        });

    } catch (error) {

        console.error("Alert loading error:", error);

    }

}


// =====================================
// SYMPTOM REPORT FORM
// =====================================

document.getElementById("symptom-form").addEventListener(
    "submit",
    event => {

        event.preventDefault();

        const message =
            document.getElementById("report-message");

        message.className = "form-message";

        message.textContent =
            "The reporting interface is ready. We still need to connect it to the health-report API.";

    }
);


// =====================================
// ASTRA ASSIST - KNOWLEDGE BASE
// =====================================

const knowledgeForm = document.getElementById("knowledge-form");
const knowledgeQuestion = document.getElementById("knowledge-question");
const knowledgeResult = document.getElementById("knowledge-result");
const knowledgeSubmit = document.getElementById("knowledge-submit");


if (knowledgeForm) {

    knowledgeForm.addEventListener("submit", async (event) => {

        event.preventDefault();

        const question = knowledgeQuestion.value.trim();

        if (!question) {
            return;
        }

        knowledgeSubmit.disabled = true;
        knowledgeSubmit.textContent = "SEARCHING...";
        knowledgeResult.textContent = "Searching ASTRA's research database...";

        try {

            const response = await fetch(`${API_URL}/knowledge/ask`, {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    question: question
                })

            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Could not process your question.");
            }

            displayKnowledgeResult(result.data);

        } catch (error) {

            console.error("ASTRA Assist error:", error);

            knowledgeResult.textContent =
                "ASTRA Assist could not connect to the knowledge service. Check that the backend is running.";

        } finally {

            knowledgeSubmit.disabled = false;
            knowledgeSubmit.textContent = "ASK ASTRA";

        }

    });

}


// =====================================
// DISPLAY KNOWLEDGE RESULTS
// =====================================

function displayKnowledgeResult(data) {

    knowledgeResult.replaceChildren();

    if (!data.found) {

        const message = document.createElement("p");
        message.textContent = data.message;

        const recommendation = document.createElement("p");
        recommendation.textContent = data.recommendation;

        knowledgeResult.append(message, recommendation);

        return;
    }

    const title = document.createElement("h3");
    title.textContent = data.topic.title;

    knowledgeResult.appendChild(title);

    const sections = [
        ["Explanation", data.answer.explanation],
        ["Spaceflight Context", data.answer.spaceflightContext],
        ["Warning Signs", data.answer.warningSigns],
        ["Escalation Guidance", data.answer.escalationGuidance],
        ["General Actions", data.answer.generalActions],
        ["Measurement Notes", data.answer.measurementNotes]
    ];

    sections.forEach(([heading, content]) => {

        if (!content || (Array.isArray(content) && content.length === 0)) {
            return;
        }

        const section = document.createElement("div");

        const sectionHeading = document.createElement("h4");
        sectionHeading.textContent = heading;

        section.appendChild(sectionHeading);

        if (Array.isArray(content)) {

            const list = document.createElement("ul");

            content.forEach(item => {

                const listItem = document.createElement("li");
                listItem.textContent = item;

                list.appendChild(listItem);

            });

            section.appendChild(list);

        } else {

            const paragraph = document.createElement("p");
            paragraph.textContent = content;

            section.appendChild(paragraph);

        }

        knowledgeResult.appendChild(section);

    });


    // SOURCE INFORMATION

    const sourceHeading = document.createElement("h4");
    sourceHeading.textContent = "Research Source";

    const source = document.createElement("p");

    source.textContent =
        `${data.source.title} — ${data.source.organisation} (${data.source.date})`;

    knowledgeResult.append(sourceHeading, source);


    // DISCLAIMER

    const disclaimer = document.createElement("p");
    disclaimer.textContent = data.disclaimer;

    knowledgeResult.appendChild(disclaimer);

}



// =====================================
// REFRESH DASHBOARD
// =====================================

async function refreshDashboard() {

    await Promise.all([
        loadReadings(),
        loadAlerts()
    ]);

}


async function initialiseDashboard() {

    await Promise.all([
        loadAnatomicalModel(),
        loadCrew()
    ]);

    await refreshDashboard();

    setInterval(refreshDashboard, 5000);

}

initialiseDashboard();
