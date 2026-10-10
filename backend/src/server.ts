
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { generateSensorData } from "./sensorSimulator";

import {
  generateDeviceDecisions,
  getDeviceState,
  setDeviceState,
  getSystemMode,
  setSystemMode,
  DeviceState,
  SystemMode,
} from "./deviceSimulator";

dotenv.config();

const app = express();

const PORT = 5000;
const AI_SERVICE_URL = "http://127.0.0.1:8000";

app.use(cors());
app.use(express.json());


// ============================================================
// HOME ROUTE
// ============================================================

app.get("/", (_req, res) => {
  res.json({
    message: "AI Smart Home Backend is running!",
    status: "online",
  });
});


// ============================================================
// HEALTH CHECK
// ============================================================

app.get("/api/health", (_req, res) => {
  res.json({
    status: "healthy",
    service: "smart-home-backend",
  });
});


// ============================================================
// SENSOR API
// ============================================================

app.get("/api/sensors", (_req, res) => {
  const sensorData = generateSensorData();
  res.json(sensorData);
});


// ============================================================
// AI ANALYSIS API
// ============================================================

app.get("/api/ai-analysis", async (_req, res) => {
  try {
    const sensorData = generateSensorData();

    const response = await fetch(`${AI_SERVICE_URL}/predict`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        temperature: sensorData.temperature,
        motion: sensorData.motion,
        light: sensorData.light,
        sound: sensorData.sound,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `AI service returned status ${response.status}`
      );
    }

    const aiResult = await response.json();

    const deviceDecision = generateDeviceDecisions(
      sensorData.temperature,
      sensorData.motion,
      sensorData.light,
      sensorData.sound,
      aiResult.occupancy
    );

    res.json({
      timestamp: sensorData.timestamp,
      mode: getSystemMode(),
      sensors: sensorData,
      ai: aiResult,
      devices: deviceDecision,
    });

  } catch (error) {
    console.error("AI service error:", error);

    res.status(503).json({
      error: "AI service unavailable",
      message:
        "Make sure the Python AI service is running on port 8000.",
    });
  }
});


// ============================================================
// SYSTEM MODE API
// ============================================================

// GET CURRENT MODE

app.get("/api/mode", (_req, res) => {
  res.json({
    mode: getSystemMode(),
  });
});


// CHANGE SYSTEM MODE

app.post("/api/mode", (req, res) => {
  const { mode } = req.body;

  if (mode !== "AUTO" && mode !== "MANUAL") {
    return res.status(400).json({
      error: "Invalid mode",
      allowedModes: ["AUTO", "MANUAL"],
    });
  }

  const updatedMode = setSystemMode(mode as SystemMode);

  console.log(`System mode changed to: ${updatedMode}`);

  return res.json({
    success: true,
    mode: updatedMode,
    message: `System switched to ${updatedMode} mode.`,
    devices: getDeviceState(),
  });
});


// ============================================================
// DEVICE API
// ============================================================

app.get("/api/devices", (_req, res) => {
  res.json({
    mode: getSystemMode(),
    devices: getDeviceState(),
  });
});


// ============================================================
// MANUAL DEVICE CONTROL API
// ============================================================

app.post("/api/devices/control", (req, res) => {
  try {
    const { device, state } = req.body;

    const validDevices: (keyof DeviceState)[] = [
      "livingRoomLight",
      "bedroomLight",
      "airConditioner",
      "television",
      "smartFan",
    ];

    if (!validDevices.includes(device)) {
      return res.status(400).json({
        error: "Invalid device",
        validDevices,
      });
    }

    if (typeof state !== "boolean") {
      return res.status(400).json({
        error: "State must be true or false",
      });
    }

    if (getSystemMode() !== "MANUAL") {
      return res.status(409).json({
        error: "Manual control is disabled in AUTO mode.",
        message:
          "Switch to MANUAL mode before controlling devices.",
        mode: getSystemMode(),
      });
    }

    const updatedDevices = setDeviceState(device, state);

    console.log(
      `Manual control: ${device} → ${state ? "ON" : "OFF"}`
    );

    return res.json({
      success: true,
      message: `${device} turned ${state ? "ON" : "OFF"}`,
      mode: getSystemMode(),
      devices: updatedDevices,
    });

  } catch (error) {
    console.error("Device control error:", error);

    return res.status(500).json({
      error: "Unable to control device",
    });
  }
});


// ============================================================
// START SERVER
// ============================================================

app.listen(PORT, () => {
  console.log("======================================");
  console.log("       AI SMART HOME BACKEND");
  console.log("======================================");
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Sensor API: http://localhost:${PORT}/api/sensors`);
  console.log(`AI API: http://localhost:${PORT}/api/ai-analysis`);
  console.log(`Mode API: http://localhost:${PORT}/api/mode`);
  console.log(`Device API: http://localhost:${PORT}/api/devices`);
  console.log(`Control API: http://localhost:${PORT}/api/devices/control`);
  console.log("======================================");
});