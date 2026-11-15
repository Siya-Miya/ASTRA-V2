import sys
import json
import wave
from pathlib import Path
from vosk import Model, KaldiRecognizer

# Locate the offline model from the ASTRA project root.
PROJECT_ROOT = Path(__file__).resolve().parents[3]
MODEL_PATH = PROJECT_ROOT / "vosk-model"

def transcribe(audio_path):

    if not MODEL_PATH.exists():
        raise FileNotFoundError("ASTRA offline speech model not found.")

    model = Model(str(MODEL_PATH))

    audio = wave.open(audio_path, "rb")

    if audio.getnchannels() != 1 or audio.getsampwidth() != 2:
        raise ValueError("Audio must be mono, 16-bit WAV.")

    recognizer = KaldiRecognizer(model, audio.getframerate())

    while True:
        data = audio.readframes(4000)

        if not data:
            break

        recognizer.AcceptWaveform(data)

    result = json.loads(recognizer.FinalResult())

    return result.get("text", "")


if __name__ == "__main__":

    try:
        audio_path = sys.argv[1]
        text = transcribe(audio_path)

        print(json.dumps({
            "success": True,
            "text": text
        }))

    except Exception as error:

        print(json.dumps({
            "success": False,
            "message": str(error)
        }))