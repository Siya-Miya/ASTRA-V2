
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { execFile } = require("child_process");

const router = express.Router();

const uploadDirectory = path.join(__dirname, "../temp-audio");

fs.mkdirSync(uploadDirectory, { recursive: true });

const upload = multer({
    dest: uploadDirectory,
    limits: {
        fileSize: 15 * 1024 * 1024
    }
});

const pythonScript = path.join(
    __dirname,
    "../services/voice/recognize.py"
);

router.post("/transcribe", upload.single("audio"), (req, res) => {

    if (!req.file) {
        return res.status(400).json({
            success: false,
            message: "No audio recording received."
        });
    }

    execFile(
        "python",
        [pythonScript, req.file.path],
        { windowsHide: true, maxBuffer: 1024 * 1024 },
        (error, stdout, stderr) => {

            // Remove the temporary recording.
            fs.unlink(req.file.path, () => { });

            if (error) {
                console.error("Voice recognition error:", stderr || error.message);

                return res.status(500).json({
                    success: false,
                    message: "ASTRA could not recognize the recording."
                });
            }

            try {
                const result = JSON.parse(stdout);

                if (!result.success) {
                    return res.status(500).json(result);
                }

                res.json(result);

            } catch (parseError) {
                console.error("Invalid Vosk response:", stdout);

                res.status(500).json({
                    success: false,
                    message: "Could not process the voice recognition result."
                });
            }
        }
    );
});

module.exports = router;
