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
// MODEL AND HEALTH EVENT VARIABLES
// =====================================

let anatomicalModel = null;
let modelBounds = null;
let selectedRegionName = null;
let healthEvents = [];

const regionMarkers = new Map();

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);


// =====================================
// LOAD ANATOMICAL MODEL
// =====================================

async function loadAnatomicalModel() {

    const loadingScreen = document.getElementById("model-loading");
    const modelStatus = document.getElementById("model-status");

    try {

        modelStatus.textContent = "DOWNLOADING ANATOMY";

        const gltf = await loader.loadAsync(MODEL_URL);

        anatomicalModel = gltf.scene;
        scene.add(anatomicalModel);

        // Calculate original model dimensions.
        const initialBounds = new THREE.Box3().setFromObject(
            anatomicalModel
        );

        const size = initialBounds.getSize(new THREE.Vector3());
        const center = initialBounds.getCenter(new THREE.Vector3());

        // Centre the model.
        anatomicalModel.position.x = -center.x;
        anatomicalModel.position.z = -center.z;
        anatomicalModel.position.y = -initialBounds.min.y;

        // Scale model.
        const targetHeight = 3.2;
        const scale = targetHeight / size.y;

        anatomicalModel.scale.setScalar(scale);

        // Preserve translucent outer skin.
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

        console.log("Model traversal starting");

        anatomicalModel.traverse(object => {

            if (!object.isMesh) return;

            object.frustumCulled = true;

        });

        // Update model transformations before measuring anatomy.
        anatomicalModel.updateMatrixWorld(true);

        modelBounds = new THREE.Box3().setFromObject(
            anatomicalModel
        );

        // Create the seven anatomical overlays.
        createAllRegionMarkers();

        // Configure camera.
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
// HEALTH EVENT VISUAL MARKERS
// =====================================

function getRegionStatus(region) {

    const latestEvent = healthEvents
        .filter(event =>
            event.event_type === "symptom_report" &&
            event.body_region?.toLowerCase() === region.toLowerCase()
        )
        .sort((a, b) =>
            new Date(b.occurred_at) - new Date(a.occurred_at)
        )[0];

    if (!latestEvent) return "none";

    const severity = String(latestEvent.severity || "").toLowerCase();

    if (severity === "severe") return "critical";
    if (severity === "moderate") return "warning";

    return "recorded";
}


function getRegionColor(status) {

    switch (status) {

        case "critical":
            return 0xff3030; // Red

        case "warning":
            return 0xffa500; // Amber

        case "recorded":
        case "none":
        default:
            return 0x398bff; // Blue

    }
}

// =====================================
// ANATOMICAL REGION MARKERS
// =====================================

function getMeshBounds(meshNames) {

    const bounds = new THREE.Box3();
    bounds.makeEmpty();

    meshNames.forEach(name => {

        const mesh = anatomicalModel.getObjectByName(name);

        if (!mesh) {
            console.warn("Anatomical mesh not found:", name);
            return;
        }

        bounds.expandByObject(mesh);

    });

    return bounds;

}


function createRegionMarker(region, shapes) {

    const markerGroup = new THREE.Group();

    const material = new THREE.MeshBasicMaterial({
        color: 0x398bff,
        transparent: true,
        opacity: 0.45,
        depthTest: true,
        depthWrite: false
    });

    const worldScale = anatomicalModel.getWorldScale(
        new THREE.Vector3()
    );

    shapes.forEach(shape => {

        const bounds = getMeshBounds(shape.meshNames);

        if (bounds.isEmpty()) return;

        const center = bounds.getCenter(
            new THREE.Vector3()
        );

        const size = bounds.getSize(
            new THREE.Vector3()
        );

        // Convert world coordinates into model-local coordinates.
        const localCenter = anatomicalModel.worldToLocal(
            center.clone()
        );

        const localSize = size.divide(worldScale);

        const geometry = new THREE.SphereGeometry(
            1,
            24,
            16
        );

        const overlay = new THREE.Mesh(
            geometry,
            material
        );
        // Keep overlays visual only; clicks should reach the anatomy.
        overlay.raycast = () => { };

        overlay.scale.set(
            localSize.x * shape.width * 0.5,
            localSize.y * shape.height * 0.5,
            localSize.z * shape.depth * 0.5
        );

        overlay.position.copy(localCenter);



        markerGroup.add(overlay);

    });

    markerGroup.userData.region = region;

    anatomicalModel.add(markerGroup);

    regionMarkers.set(region, markerGroup);

}


// Update colours when new health events arrive.
function updateRegionMarkerColors() {

    console.log("Updating ASTRA body markers");

    regionMarkers.forEach((markerGroup, region) => {

        const status = getRegionStatus(region);
        const color = getRegionColor(status);

        console.log(`${region}: ${status}`);

        markerGroup.traverse(object => {

            if (!object.isMesh) return;

            object.material.color.setHex(color);
            object.material.needsUpdate = true;

        });

    });

}


// Create all seven logical health regions.
function createAllRegionMarkers() {

    if (!anatomicalModel) return;

    // HEAD
    createRegionMarker("Head", [
        {
            meshNames: ["skull"],
            width: 0.90,
            height: 0.90,
            depth: 0.90
        }
    ]);

    // NECK
    createRegionMarker("Neck", [
        {
            meshNames: [
                "spine_cervical",
                "neck_muscles_l",
                "neck_muscles_r"
            ],
            width: 0.85,
            height: 0.95,
            depth: 0.90
        }
    ]);

    // CHEST
    createRegionMarker("Chest", [
        {
            meshNames: [
                "sternum",
                "ribs_l",
                "ribs_r",
                "chest_muscles_l",
                "chest_muscles_r"
            ],
            width: 0.95,
            height: 0.95,
            depth: 0.95
        }
    ]);

    // ABDOMEN
    createRegionMarker("Abdomen", [
        {
            meshNames: ["abdominal_muscles"],
            width: 0.90,
            height: 0.95,
            depth: 0.90
        }
    ]);

    // PELVIS
    createRegionMarker("Pelvis", [
        {
            meshNames: ["pelvis", "pelvic_floor"],
            width: 0.95,
            height: 0.90,
            depth: 0.95
        }
    ]);

    // ARMS
    createRegionMarker("Arms", [
        {
            meshNames: [
                "humerus_l",
                "forearm_l",
                "upper_arm_muscles_l",
                "forearm_muscles_l"
            ],
            width: 0.85,
            height: 1.00,
            depth: 0.85
        },
        {
            meshNames: [
                "humerus_r",
                "forearm_r",
                "upper_arm_muscles_r",
                "forearm_muscles_r"
            ],
            width: 0.85,
            height: 1.00,
            depth: 0.85
        }
    ]);

    // LEGS
    createRegionMarker("Legs", [
        {
            meshNames: [
                "femur_l",
                "lower_leg_l",
                "calf_l"
            ],
            width: 0.85,
            height: 1.00,
            depth: 0.85
        },
        {
            meshNames: [
                "femur_r",
                "lower_leg_r",
                "calf_r"
            ],
            width: 0.85,
            height: 1.00,
            depth: 0.85
        }
    ]);

}


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

    const normalizedY =
        (point.y - modelBounds.min.y) / size.y;

    const normalizedX =
        Math.abs(point.x - center.x) / size.x;

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

    const regionEvents = healthEvents.filter(event =>
        event.body_region?.toLowerCase() === region.toLowerCase()
    );

    document.getElementById("selected-region").textContent =
        `${region} selected (${regionEvents.length} recorded events)`;

    document.getElementById("symptom-region").value = region;

    document.getElementById("report-region-button").disabled = false;

    console.log(`Health events for ${region}:`, regionEvents);

}


canvas.addEventListener("pointerdown", event => {

    pointerStartX = event.clientX;
    pointerStartY = event.clientY;

});


canvas.addEventListener("pointerup", event => {

    const movement = Math.hypot(
        event.clientX - pointerStartX,
        event.clientY - pointerStartY
    );

    if (movement > 5 || !anatomicalModel) return;

    const rect = canvas.getBoundingClientRect();

    pointer.x =
        ((event.clientX - rect.left) / rect.width) * 2 - 1;

    pointer.y =
        -((event.clientY - rect.top) / rect.height) * 2 + 1;

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

        if (!Array.isArray(readings) || readings.length === 0) {
            return;
        }

        // Find the newest reading for every metric.
        const latest = {};

        readings.forEach(reading => {

            const recordedAt = String(
                reading.recorded_at || ""
            );

            const current = latest[reading.metric];

            if (!current) {
                latest[reading.metric] = reading;
                return;
            }

            const currentTime = new Date(
                String(current.recorded_at).replace(" ", "T") + "Z"
            ).getTime();

            const newTime = new Date(
                recordedAt.replace(" ", "T") + "Z"
            ).getTime();

            if (newTime >= currentTime) {
                latest[reading.metric] = reading;
            }

        });


        // Metric-to-dashboard element mapping.
        const metricDisplays = {

            heart_rate: [
                "heart-rate",
                "overview-heart-rate"
            ],

            oxygen_saturation: [
                "oxygen",
                "overview-oxygen"
            ],

            body_temperature: [
                "temperature",
                "overview-temperature"
            ],

            respiratory_rate: [
                "respiratory-rate",
                "overview-respiratory"
            ],

            cabin_temperature: [
                "overview-cabin-temperature"
            ],

            cabin_pressure: [
                "overview-cabin-pressure"
            ],

            cabin_oxygen: [
                "overview-cabin-oxygen"
            ],

            carbon_dioxide: [
                "overview-carbon-dioxide"
            ],

            humidity: [
                "overview-humidity"
            ],

            radiation_dose_rate: [
                "overview-radiation"
            ]

        };


        // Update every available dashboard reading.
        Object.entries(metricDisplays).forEach(([metric, elementIds]) => {

            const reading = latest[metric];

            if (!reading) return;

            const value = Number(reading.value);

            if (!Number.isFinite(value)) return;

            elementIds.forEach(elementId => {

                const element = document.getElementById(elementId);

                if (element) {
                    element.textContent = value.toFixed(1);
                }

            });

        });


        // Find the latest timestamp across all metrics.
        const timestamps = Object.values(latest).map(reading => {

            const recordedAt = String(reading.recorded_at || "");

            return new Date(
                recordedAt.replace(" ", "T") + "Z"
            ).getTime();

        }).filter(Number.isFinite);


        if (timestamps.length > 0) {

            document.getElementById("last-updated").textContent =
                new Date(Math.max(...timestamps)).toLocaleTimeString();

        }


        document.getElementById("sensor-status").textContent =
            "RECEIVING SIMULATED DATA";

        document.getElementById("health-status").textContent =
            "DATA AVAILABLE";


    } catch (error) {

        console.error("Reading loading error:", error);

        document.getElementById("sensor-status").textContent =
            "CONNECTION ERROR";

    }

}



// =====================================
// LOAD HEALTH EVENTS
// =====================================

async function loadHealthEvents() {

    try {

        const response = await fetch(
            `${API_URL}/health-events?crew_id=${astronautId}`
        );

        if (!response.ok) {
            throw new Error("Could not retrieve health events.");
        }

        const result = await response.json();

        healthEvents = result.data || [];

        filterMedicalHistory();
        updateRegionMarkerColors();

        console.log("ASTRA health events:", healthEvents);

    } catch (error) {

        console.error("Health event loading error:", error);

    }

}


// =====================================
// RENDER MEDICAL HISTORY
// =====================================


function renderMedicalHistory(events) {

    const container = document.getElementById("history-container");
    const count = document.getElementById("history-count");

    // Remember which reports are currently expanded.
    const openEventKeys = new Set(
        Array.from(container.querySelectorAll(".history-item[open]"))
            .map(item => item.dataset.eventKey)
    );

    container.innerHTML = ""; count.textContent = events.length;

    if (events.length === 0) {
        container.innerHTML =
            '<p class="empty-state">No medical history available.</p>';
        return;
    }

    events.forEach(event => {

        const item = document.createElement("details");
        item.className = "history-item";
        // Give each event a stable identity.
        const eventKey = event.id != null
            ? `${event.event_type || ""}|${event.id}`
            : `${event.event_type || ""}|${event.occurred_at || ""}|${event.title || ""}|${event.body_region || ""}`;

        item.dataset.eventKey = eventKey;

        // =====================================
        // DATE FORMATTING
        // =====================================

        let date = "Time unavailable";

        if (event.occurred_at) {

            const dateValue = String(event.occurred_at);

            const normalizedDate = dateValue.includes("T")
                ? dateValue
                : dateValue.replace(" ", "T") + "Z";

            const parsedDate = new Date(normalizedDate);

            if (!Number.isNaN(parsedDate.getTime())) {
                date = parsedDate.toLocaleString();
            }
        }

        // =====================================
        // EVENT HEADING
        // =====================================

        const heading = document.createElement("summary");

        const title = document.createElement("strong");
        title.textContent = event.title || "Health event";

        const metadata = document.createElement("small");

        const eventType =
            event.event_type === "symptom_report"
                ? "SYMPTOM REPORT"
                : "SENSOR ALERT";

        metadata.textContent =
            `${eventType} | ${event.body_region || "General"}`;

        // Summary information: severity + date.
        const summaryMeta = document.createElement("div");
        summaryMeta.className = "history-summary-meta";

        const severityValue =
            (event.severity || "unspecified").toLowerCase();

        const summarySeverity = document.createElement("span");
        summarySeverity.className =
            `history-severity ${severityValue}`;

        summarySeverity.textContent =
            event.severity || "Unspecified";

        const summaryDate = document.createElement("small");
        summaryDate.className = "history-summary-date";
        summaryDate.textContent = date;

        summaryMeta.appendChild(summarySeverity);
        summaryMeta.appendChild(summaryDate);

        heading.appendChild(title);
        heading.appendChild(metadata);
        heading.appendChild(summaryMeta);

        // =====================================
        // EXPANDED EVENT DETAILS
        // =====================================

        const content = document.createElement("div");
        content.className = "history-details";

        const timestamp = document.createElement("p");
        timestamp.textContent = `Recorded: ${date}`;

        // Severity.
        const severity = document.createElement("span");

        severity.className =
            `history-severity ${severityValue}`;

        severity.textContent =
            `Severity: ${event.severity || "Unspecified"}`;

        // Status.
        const statusValue =
            (event.status || "unknown").toLowerCase();

        const status = document.createElement("span");

        status.className =
            `history-status ${statusValue}`;

        status.textContent =
            `Status: ${event.status || "Unknown"}`;


        content.appendChild(timestamp);
        content.appendChild(severity);
        content.appendChild(status);

        // Show resolution timestamp.
        if (event.resolved_at) {

            const resolved = document.createElement("p");

            resolved.textContent =
                `Resolved: ${new Date(
                    event.resolved_at.replace(" ", "T") + "Z"
                ).toLocaleString()}`;

            content.appendChild(resolved);

        }

        // =====================================
        // ASTRA RESPONSE
        // =====================================


        if (event.astra_response_json) {

            let parsedResponse;

            try {

                parsedResponse =
                    typeof event.astra_response_json === "string"
                        ? JSON.parse(event.astra_response_json)
                        : event.astra_response_json;

            } catch (error) {

                parsedResponse = {
                    message: String(event.astra_response_json)
                };

            }

            const responsePanel = document.createElement("div");
            responsePanel.className = "astra-response";

            const responseHeading = document.createElement("strong");
            responseHeading.textContent = "ASTRA ASSIST";

            const responseStatus = document.createElement("span");

            const found = parsedResponse.found === true;

            responseStatus.className =
                `astra-response-status ${found ? "found" : "not-found"}`;

            responseStatus.textContent = found
                ? "KNOWLEDGE MATCH FOUND"
                : "NO RELEVANT KNOWLEDGE FOUND";

            const responseMessage = document.createElement("p");
            responseMessage.textContent =
                parsedResponse.message || "No response message available.";

            responsePanel.appendChild(responseHeading);
            responsePanel.appendChild(responseStatus);
            responsePanel.appendChild(responseMessage);

            if (parsedResponse.recommendation) {

                const recommendation = document.createElement("div");
                recommendation.className = "astra-recommendation";

                const recommendationHeading = document.createElement("strong");
                recommendationHeading.textContent = "RECOMMENDATION";

                const recommendationText = document.createElement("p");
                recommendationText.textContent = parsedResponse.recommendation;

                recommendation.appendChild(recommendationHeading);
                recommendation.appendChild(recommendationText);

                responsePanel.appendChild(recommendation);
            }

            content.appendChild(responsePanel);
        }


        item.appendChild(heading);
        item.appendChild(content);

        // Restore its expanded state after refreshing.
        if (openEventKeys.has(eventKey)) {
            item.open = true;
        }

        container.appendChild(item);

    });

}



// =====================================
// FILTER MEDICAL HISTORY
// =====================================

function filterMedicalHistory() {

    const region =
        document.getElementById("history-region-filter").value;

    const type =
        document.getElementById("history-type-filter").value;

    const filteredEvents = healthEvents.filter(event => {

        const matchesRegion =
            region === "all" || event.body_region === region;

        const matchesType =
            type === "all" || event.event_type === type;

        return matchesRegion && matchesType;

    });

    renderMedicalHistory(filteredEvents);

}


// =====================================
// SYMPTOM REPORT FORM
// =====================================

document.getElementById("symptom-form").addEventListener(
    "submit",
    async event => {

        event.preventDefault();

        const message = document.getElementById("report-message");

        const submitButton = event.target.querySelector(
            'button[type="submit"]'
        );

        const report = {
            crew_id: astronautId,

            body_region:
                document.getElementById("symptom-region").value,

            description:
                document.getElementById("symptom-description").value.trim(),

            severity:
                document.getElementById("symptom-severity").value,

            onset:
                document.getElementById("symptom-onset").value,

            notes:
                document.getElementById("symptom-notes").value.trim()
        };

        if (!report.description) {

            message.textContent = "Please describe the symptom.";
            return;

        }

        message.className = "form-message";
        message.textContent = "Submitting report to ASTRA...";

        submitButton.disabled = true;

        try {

            const response = await fetch(
                `${API_URL}/health-reports`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify(report)
                }
            );

            const result = await response.json();

            if (!response.ok || !result.success) {

                throw new Error(
                    result.message || "Could not submit report."
                );

            }

            const astraResponse = result.data.astra_response;

            message.textContent = astraResponse?.found
                ? `Report saved successfully. ASTRA found relevant research: ${astraResponse.topic.title}.`
                : "Report saved successfully. ASTRA could not find matching research in its current knowledge base.";

            // Clear the form after successful submission.
            event.target.reset();

            // Immediately reload medical history.
            await loadHealthEvents();

            console.log("Saved health report:", result.data.report);
            console.log("ASTRA response:", astraResponse);

        } catch (error) {

            console.error("Health report submission error:", error);

            message.textContent =
                "ASTRA could not submit the report. Check the backend connection.";

        } finally {

            submitButton.disabled = false;

        }

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

    knowledgeForm.addEventListener("submit", async event => {

        event.preventDefault();

        const question = knowledgeQuestion.value.trim();

        if (!question) return;

        knowledgeSubmit.disabled = true;
        knowledgeSubmit.textContent = "SEARCHING...";
        knowledgeResult.textContent =
            "Searching ASTRA's research database...";

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

                throw new Error(
                    result.message || "Could not process your question."
                );

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
// ASTRA ASSIST - OFFLINE VOICE INPUT
// =====================================

const voiceButton = document.getElementById("voice-input-button");

let audioContext;
let microphoneStream;
let microphoneSource;
let audioProcessor;
let audioChunks = [];
let isRecording = false;

if (voiceButton) {

    voiceButton.addEventListener("click", async () => {

        // STOP RECORDING
        if (isRecording) {

            isRecording = false;

            audioProcessor.disconnect();
            microphoneSource.disconnect();

            microphoneStream.getTracks().forEach(track => track.stop());

            await audioContext.close();

            voiceButton.textContent = "🎙";
            voiceButton.disabled = true;

            voiceButton.title = "Processing recording...";

            const audioBlob = createWavBlob(audioChunks, 44100);

            audioChunks = [];

            try {

                const formData = new FormData();
                formData.append("audio", audioBlob, "recording.wav");

                const response = await fetch(
                    `${API_URL}/voice/transcribe`,
                    {
                        method: "POST",
                        body: formData
                    }
                );

                const result = await response.json();

                if (!response.ok || !result.success) {
                    throw new Error(result.message || "Voice recognition failed.");
                }

                if (!result.text.trim()) {
                    knowledgeResult.textContent =
                        "ASTRA could not detect any speech. Please try again.";
                    return;
                }

                // Put recognized speech into the question box.
                knowledgeQuestion.value = result.text;

                // Send the recognized question to ASTRA Assist.
                knowledgeForm.requestSubmit();

            } catch (error) {

                console.error("ASTRA voice error:", error);

                knowledgeResult.textContent =
                    "Voice recognition failed: " + error.message;

            } finally {

                voiceButton.disabled = false;
                voiceButton.title = "Speak to ASTRA";

            }

            return;
        }

        // START RECORDING
        try {

            microphoneStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true
                }
            });

            audioContext = new AudioContext({
                sampleRate: 44100
            });

            microphoneSource =
                audioContext.createMediaStreamSource(microphoneStream);

            audioProcessor =
                audioContext.createScriptProcessor(4096, 1, 1);

            audioChunks = [];

            audioProcessor.onaudioprocess = event => {

                if (!isRecording) return;

                const samples = event.inputBuffer.getChannelData(0);

                audioChunks.push(new Float32Array(samples));

            };

            // Keep the processor active without playing microphone audio.
            const silentGain = audioContext.createGain();
            silentGain.gain.value = 0;

            microphoneSource.connect(audioProcessor);
            audioProcessor.connect(silentGain);
            silentGain.connect(audioContext.destination);

            isRecording = true;

            voiceButton.textContent = "⏹";
            voiceButton.title = "Stop recording";

            knowledgeResult.textContent =
                "Listening... Speak to ASTRA, then press stop.";

        } catch (error) {

            console.error("Microphone error:", error);

            knowledgeResult.textContent =
                "Could not access your microphone. Check browser permissions.";

        }

    });

}


// =====================================
// CONVERT MICROPHONE AUDIO TO WAV
// =====================================

function createWavBlob(chunks, sampleRate) {

    const totalLength = chunks.reduce(
        (total, chunk) => total + chunk.length,
        0
    );

    const samples = new Float32Array(totalLength);

    let offset = 0;

    for (const chunk of chunks) {
        samples.set(chunk, offset);
        offset += chunk.length;
    }

    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    function writeString(position, value) {
        for (let i = 0; i < value.length; i++) {
            view.setUint8(position + i, value.charCodeAt(i));
        }
    }

    writeString(0, "RIFF");
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, "data");
    view.setUint32(40, samples.length * 2, true);

    let position = 44;

    for (let i = 0; i < samples.length; i++) {

        const sample = Math.max(-1, Math.min(1, samples[i]));

        view.setInt16(
            position,
            sample < 0 ? sample * 32768 : sample * 32767,
            true
        );

        position += 2;
    }

    return new Blob([buffer], { type: "audio/wav" });
}


// =====================================
// DISPLAY KNOWLEDGE RESULTS
// =====================================


function displayKnowledgeResult(data) {

    knowledgeResult.replaceChildren();

    // Collect text for ASTRA's voice.
    let speechText = "";

    if (!data.found) {

        const message = document.createElement("p");
        message.textContent = data.message;

        const recommendation = document.createElement("p");
        recommendation.textContent = data.recommendation;

        knowledgeResult.append(message, recommendation);

        speechText = [
            data.message,
            data.recommendation
        ].filter(Boolean).join(". ");

        speakASTRA(speechText);
        latestASTRAResponse = knowledgeResult.innerText;

        if (autoReadAloud) {
            speakASTRA(latestASTRAResponse);
        }

        return;
    }

    const title = document.createElement("h3");
    title.textContent = data.topic.title;

    knowledgeResult.appendChild(title);

    speechText += data.topic.title + ". ";

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

        speechText += heading + ". ";

        if (Array.isArray(content)) {

            const list = document.createElement("ul");

            content.forEach(item => {

                const listItem = document.createElement("li");
                listItem.textContent = item;

                list.appendChild(listItem);

                speechText += item + ". ";

            });

            section.appendChild(list);

        } else {

            const paragraph = document.createElement("p");
            paragraph.textContent = content;

            section.appendChild(paragraph);

            speechText += content + ". ";

        }

        knowledgeResult.appendChild(section);

    });

    // Source information.
    const sourceHeading = document.createElement("h4");
    sourceHeading.textContent = "Research Source";

    const source = document.createElement("p");

    source.textContent =
        `${data.source.title} — ${data.source.organisation} (${data.source.date})`;

    knowledgeResult.append(sourceHeading, source);

    // Disclaimer.
    const disclaimer = document.createElement("p");
    disclaimer.textContent = data.disclaimer;

    knowledgeResult.appendChild(disclaimer);
    latestASTRAResponse = knowledgeResult.innerText;

    if (autoReadAloud) {
        speakASTRA(latestASTRAResponse);
    }

    speechText += "Important disclaimer. " + data.disclaimer;

    // ASTRA speaks the complete response.
    speakASTRA(speechText);
}


// =====================================
// LOAD OTHER CREW MEMBERS' STATUSES
// =====================================

async function loadCrewStatuses() {

    const container = document.getElementById("crew-status-list");

    try {

        // Retrieve all crew members.
        const crewResponse = await fetch(`${API_URL}/crew`);

        if (!crewResponse.ok) {
            throw new Error("Could not retrieve crew members.");
        }

        const crew = await crewResponse.json();

        // Retrieve current alerts.
        const alertsResponse = await fetch(`${API_URL}/alerts`);

        if (!alertsResponse.ok) {
            throw new Error("Could not retrieve crew alerts.");
        }

        const alertsResult = await alertsResponse.json();

        const alerts = Array.isArray(alertsResult)
            ? alertsResult
            : alertsResult.data || [];

        // Exclude the astronaut using this personal station.
        const otherCrew = crew.filter(
            member => Number(member.id) !== astronautId
        );

        // Retrieve readings for each of the other crew members.
        const crewStatuses = await Promise.all(

            otherCrew.map(async member => {

                const response = await fetch(
                    `${API_URL}/readings?crew_id=${member.id}`
                );

                if (!response.ok) {
                    throw new Error(
                        `Could not retrieve readings for ${member.name}.`
                    );
                }

                const readings = await response.json();

                // Find the most recent reading.
                const latestReading = Array.isArray(readings)
                    ? readings.reduce((latest, reading) => {

                        if (!latest) return reading;

                        const latestTime = new Date(
                            String(latest.recorded_at).replace(" ", "T") + "Z"
                        ).getTime();

                        const readingTime = new Date(
                            String(reading.recorded_at).replace(" ", "T") + "Z"
                        ).getTime();

                        return readingTime > latestTime
                            ? reading
                            : latest;

                    }, null)
                    : null;

                // Check for unresolved alerts belonging to this crew member.
                const activeAlerts = alerts.filter(alert => {

                    const belongsToCrew =
                        Number(alert.crew_id) === Number(member.id);

                    const status = String(
                        alert.status || "active"
                    ).toLowerCase();

                    const unresolved =
                        status !== "resolved" &&
                        status !== "closed";

                    return belongsToCrew && unresolved;

                });

                const hasCriticalAlert = activeAlerts.some(alert =>
                    String(alert.severity || "").toLowerCase() === "critical"
                );

                const hasWarningAlert = activeAlerts.length > 0;

                // Check whether the latest reading is still recent.
                let hasSignal = false;

                if (latestReading?.recorded_at) {

                    const latestTime = new Date(
                        String(latestReading.recorded_at).replace(" ", "T") + "Z"
                    ).getTime();

                    const age = Date.now() - latestTime;

                    hasSignal =
                        Number.isFinite(latestTime) &&
                        age >= -5000 &&
                        age <= 20000;

                }

                // Determine the crew member's overall status.
                let status = "healthy";

                if (hasCriticalAlert) {

                    status = "critical";

                } else if (!hasSignal) {

                    status = "no-signal";

                } else if (hasWarningAlert) {

                    status = "warning";

                }

                return {
                    id: member.id,
                    name: member.name,
                    crewCode: member.crew_code,
                    status: status
                };

            })

        );


        // Render the crew members in the sidebar.
        container.replaceChildren();

        crewStatuses.forEach(member => {

            const item = document.createElement("div");
            item.className = `crew-member-item ${member.status}`;

            const dot = document.createElement("span");
            dot.className = "crew-status-dot";

            const details = document.createElement("div");
            details.className = "crew-member-details";

            const name = document.createElement("strong");
            name.textContent = member.name;

            const code = document.createElement("small");
            code.textContent = member.crewCode;

            details.append(name, code);

            const status = document.createElement("span");
            status.className = "crew-member-status";

            const statusLabels = {
                healthy: "HEALTHY",
                warning: "WARNING",
                critical: "CRITICAL",
                "no-signal": "NO SIGNAL"
            };

            status.textContent = statusLabels[member.status];

            item.append(dot, details, status);

            container.appendChild(item);

        });

    } catch (error) {

        console.error("Crew status loading error:", error);

        container.innerHTML =
            '<p class="crew-loading">Unable to retrieve crew status.</p>';

    }

}

// =====================================
// REFRESH DASHBOARD
// =====================================

async function refreshDashboard() {

    await Promise.all([
        loadReadings(),
        loadHealthEvents(),
        loadCrewStatuses()
    ]);

}


// =====================================
// INITIALISE DASHBOARD
// =====================================

async function initialiseDashboard() {

    await Promise.all([
        loadAnatomicalModel(),
        loadCrew()
    ]);

    await refreshDashboard();

    setInterval(refreshDashboard, 5000);

    document.getElementById("history-region-filter")
        .addEventListener("change", filterMedicalHistory);

    document.getElementById("history-type-filter")
        .addEventListener("change", filterMedicalHistory);

}

initialiseDashboard();


// =====================================
// ASTRA ASSIST - OFFLINE VOICE OUTPUT
// =====================================


// =====================================
// ASTRA ASSIST - SPEECH CONTROLS
// =====================================

let latestASTRAResponse = "";

let autoReadAloud =
    localStorage.getItem("astraAutoReadAloud") === "true";

let isASTRASpeaking = false;

const readAloudButton =
    document.getElementById("read-aloud-button");

const autoReadToggle =
    document.getElementById("auto-read-toggle");


// Update automatic speech button.
function updateAutoReadButton() {

    autoReadToggle.textContent =
        autoReadAloud
            ? "AUTO READ ALOUD: ON"
            : "AUTO READ ALOUD: OFF";

    autoReadToggle.setAttribute(
        "aria-pressed",
        String(autoReadAloud)
    );
}

updateAutoReadButton();


// Speak ASTRA's response.
function speakASTRA(text) {

    if (!("speechSynthesis" in window) || !text) return;

    window.speechSynthesis.cancel();

    const speech = new SpeechSynthesisUtterance(text);

    speech.lang = "en-US";
    speech.rate = 0.95;
    speech.pitch = 1;
    speech.volume = 1;

    isASTRASpeaking = true;
    readAloudButton.textContent = "STOP SPEAKING";

    speech.onend = () => {
        isASTRASpeaking = false;
        readAloudButton.textContent = "READ ALOUD";
    };

    speech.onerror = () => {
        isASTRASpeaking = false;
        readAloudButton.textContent = "READ ALOUD";
    };

    window.speechSynthesis.speak(speech);
}


// Manual read aloud / stop button.
readAloudButton.addEventListener("click", () => {

    if (isASTRASpeaking) {

        window.speechSynthesis.cancel();

        isASTRASpeaking = false;
        readAloudButton.textContent = "READ ALOUD";

    } else {

        speakASTRA(latestASTRAResponse);

    }

});


// Automatic speech preference.
autoReadToggle.addEventListener("click", () => {

    autoReadAloud = !autoReadAloud;

    localStorage.setItem(
        "astraAutoReadAloud",
        String(autoReadAloud)
    );

    updateAutoReadButton();

    if (!autoReadAloud && isASTRASpeaking) {

        window.speechSynthesis.cancel();

        isASTRASpeaking = false;
        readAloudButton.textContent = "READ ALOUD";

    }

});

