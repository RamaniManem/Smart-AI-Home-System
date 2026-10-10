from fastapi import FastAPI
from pydantic import BaseModel
import joblib
import os


# ============================================================
# APPLICATION
# ============================================================

app = FastAPI(
    title="AI Smart Home Service",
    description="Machine learning service for smart home intelligence",
    version="1.0.0",
)


# ============================================================
# MODEL PATHS
# ============================================================

OCCUPANCY_MODEL_PATH = "models/occupancy_model.pkl"
ENERGY_MODEL_PATH = "models/energy_model.pkl"


# ============================================================
# LOAD MODELS
# ============================================================

if not os.path.exists(OCCUPANCY_MODEL_PATH):
    raise FileNotFoundError(
        "Occupancy model not found. Run train_models.py first."
    )

if not os.path.exists(ENERGY_MODEL_PATH):
    raise FileNotFoundError(
        "Energy model not found. Run train_models.py first."
    )


occupancy_model = joblib.load(OCCUPANCY_MODEL_PATH)
energy_model = joblib.load(ENERGY_MODEL_PATH)


# ============================================================
# SENSOR DATA MODEL
# ============================================================

class SensorData(BaseModel):
    temperature: float
    motion: bool
    light: float
    sound: float


# ============================================================
# HOME PAGE
# ============================================================

@app.get("/")
def home():
    return {
        "service": "AI Smart Home Service",
        "status": "online",
        "models": [
            "occupancy_prediction",
            "energy_optimization",
        ],
    }


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "python-ai-service",
        "occupancy_model": "loaded",
        "energy_model": "loaded",
    }


# ============================================================
# OCCUPANCY PREDICTION
# ============================================================

@app.post("/predict/occupancy")
def predict_occupancy(data: SensorData):

    features = [[
        data.temperature,
        int(data.motion),
        data.light,
        data.sound,
    ]]

    prediction = occupancy_model.predict(features)[0]

    occupancy_probability = None

    if hasattr(occupancy_model, "predict_proba"):
        probability = occupancy_model.predict_proba(features)[0]
        occupancy_probability = float(probability[1])

    return {
        "occupancy": bool(prediction),
        "occupancy_probability": occupancy_probability,
    }


# ============================================================
# ENERGY PREDICTION
# ============================================================

@app.post("/predict/energy")
def predict_energy(data: SensorData):

    occupancy = (
        data.motion or data.sound > 45
    )

    features = [[
        data.temperature,
        int(data.motion),
        data.light,
        data.sound,
        int(occupancy),
    ]]

    predicted_energy = energy_model.predict(features)[0]

    return {
        "predicted_energy": round(float(predicted_energy), 3),
        "unit": "relative energy units",
    }


# ============================================================
# COMBINED AI ANALYSIS
# ============================================================

@app.post("/predict")
def predict(data: SensorData):

    features_occupancy = [[
        data.temperature,
        int(data.motion),
        data.light,
        data.sound,
    ]]

    occupancy_prediction = occupancy_model.predict(
        features_occupancy
    )[0]

    occupancy_probability = None

    if hasattr(occupancy_model, "predict_proba"):
        probability = occupancy_model.predict_proba(
            features_occupancy
        )[0]

        occupancy_probability = float(probability[1])

    predicted_occupancy = bool(occupancy_prediction)

    features_energy = [[
        data.temperature,
        int(data.motion),
        data.light,
        data.sound,
        int(predicted_occupancy),
    ]]

    predicted_energy = energy_model.predict(
        features_energy
    )[0]

    if predicted_occupancy:
        recommendation = (
            "Home appears occupied. Maintain essential "
            "comfort systems and optimize unnecessary loads."
        )
    else:
        recommendation = (
            "Home appears empty. Consider switching off "
            "unnecessary lights and appliances."
        )

    return {
        "occupancy": predicted_occupancy,
        "occupancy_probability": occupancy_probability,
        "predicted_energy": round(
            float(predicted_energy),
            3
        ),
        "recommendation": recommendation,
    }