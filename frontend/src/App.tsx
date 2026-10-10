
import { useEffect, useRef, useState } from "react";
import "./App.css";

interface SensorData {
  timestamp: string;
  temperature: number;
  motion: boolean;
  light: number;
  sound: number;
  occupancy: boolean;
}

interface AIResult {
  occupancy: boolean;
  occupancy_probability: number | null;
  predicted_energy: number;
  recommendation: string;
}

interface DeviceState {
  livingRoomLight: boolean;
  bedroomLight: boolean;
  airConditioner: boolean;
  television: boolean;
  smartFan: boolean;
}

interface DeviceDecision {
  devices: DeviceState;
  actions: string[];
  energyMode: string;
}

type SystemMode = "AUTO" | "MANUAL";
type DeviceName = keyof DeviceState;

interface AppAlert {
  id: string;
  timestamp: string;
  severity: "warning" | "info";
  title: string;
  message: string;
}

interface SpeechRecognitionAlternative {
  transcript: string;
}

interface SpeechRecognitionResult {
  0: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResult>;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionWindow extends Window {
  SpeechRecognition?: new () => SpeechRecognitionInstance;
  webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
}

interface AIAnalysis {
  timestamp: string;
  mode?: SystemMode;
  sensors: SensorData;
  ai: AIResult;
  devices: DeviceDecision;
}

function App() {
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [backendStatus, setBackendStatus] = useState("Connecting...");
  const [lastUpdate, setLastUpdate] = useState("");
  const [controlMessage, setControlMessage] = useState("");
  const [controllingDevice, setControllingDevice] =
    useState<DeviceName | null>(null);
  const [mode, setMode] = useState<SystemMode>("AUTO");
  const [changingMode, setChangingMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState(
    "Press Start Listening and allow microphone access to use voice commands."
  );
  const [lastVoiceCommand, setLastVoiceCommand] = useState("");
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [alerts, setAlerts] = useState<AppAlert[]>([]);
  const previousAlertConditions = useRef<Record<string, boolean>>({});
  const lastAlertAt = useRef<Record<string, number>>({});
  const ALERT_COOLDOWN_MS = 60_000;

  // ==========================================================
  // FETCH AI ANALYSIS
  // ==========================================================

  const fetchAIAnalysis = async () => {
    try {
      const response = await fetch(
        "http://localhost:5000/api/ai-analysis"
      );

      if (!response.ok) {
        throw new Error("AI analysis unavailable");
      }

      const data: AIAnalysis = await response.json();

      setAnalysis(data);

      if (data.mode) {
        setMode(data.mode);
      }

      // Create an in-app alert only when a condition first becomes active.
      // This avoids repeating the same alert every three-second refresh.
      const conditions: Array<{
        key: string;
        active: boolean;
        severity: "warning" | "info";
        title: string;
        message: string;
      }> = [
        {
          key: "high-temperature",
          active: data.sensors.temperature >= 30,
          severity: "warning",
          title: "High temperature",
          message: `Temperature is ${data.sensors.temperature} °C. Check room cooling or ventilation.`,
        },
        {
          key: "motion-detected",
          active: data.sensors.motion,
          severity: "info",
          title: "Motion detected",
          message: "The motion sensor is currently detecting movement.",
        },
        {
          key: "occupancy-detected",
          active: data.sensors.occupancy,
          severity: "info",
          title: "Home occupied",
          message: "The sensor system currently reports occupancy.",
        },
        {
          key: "ai-high-temperature",
          active: data.ai.recommendation.toLowerCase().includes("temperature") ||
            data.ai.recommendation.toLowerCase().includes("cool"),
          severity: "warning",
          title: "AI recommendation",
          message: data.ai.recommendation,
        },
      ];

      const now = Date.now();

      // Show an alert only when its condition becomes active and its own
      // 60-second cooldown has elapsed.
      const newlyActive = conditions.filter((condition) => {
        const becameActive =
          condition.active && !previousAlertConditions.current[condition.key];
        const lastShownAt = lastAlertAt.current[condition.key] ?? 0;
        return becameActive && now - lastShownAt >= ALERT_COOLDOWN_MS;
      });

      // Always update sensor states, even when cooldown suppresses an alert.
      // Each alert type keeps its own independent cooldown timer.
      previousAlertConditions.current = Object.fromEntries(
        conditions.map((condition) => [condition.key, condition.active])
      );

      if (newlyActive.length > 0) {
        const createdAt = new Date(now).toISOString();
        const newAlerts: AppAlert[] = newlyActive.map((condition, index) => {
          lastAlertAt.current[condition.key] = now;
          return {
            id: `${condition.key}-${now}-${index}`,
            timestamp: createdAt,
            severity: condition.severity,
            title: condition.title,
            message: condition.message,
          };
        });

        setAlerts((current) => [...newAlerts, ...current].slice(0, 30));
      }

      setBackendStatus("Online");
      setLastUpdate(
        new Date(data.timestamp).toLocaleTimeString()
      );
    } catch (error) {
      console.error("Dashboard error:", error);
      setBackendStatus("Offline");
    }
  };

  // ==========================================================
  // CHANGE AUTO / MANUAL MODE
  // ==========================================================

  const changeMode = async (newMode: SystemMode) => {
    if (newMode === mode || changingMode) {
      return;
    }

    try {
      setChangingMode(true);
      setControlMessage("Changing system mode...");

      const response = await fetch(
        "http://localhost:5000/api/mode",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            mode: newMode,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Unable to change system mode");
      }

      const result = await response.json();

      setMode(result.mode);

      setControlMessage(
        `System switched to ${result.mode} mode`
      );

      // Refresh analysis using the newly selected mode.
      await fetchAIAnalysis();
    } catch (error) {
      console.error("Mode change error:", error);
      setControlMessage("Unable to change system mode");
    } finally {
      setChangingMode(false);

      window.setTimeout(() => {
        setControlMessage("");
      }, 3000);
    }
  };

  // ==========================================================
  // MANUAL DEVICE CONTROL
  // ==========================================================

  const controlDevice = async (
    device: DeviceName,
    state: boolean
  ) => {
    if (mode !== "MANUAL") {
      setControlMessage("Switch to MANUAL mode to control devices.");
      return;
    }

    try {
      setControllingDevice(device);
      setControlMessage("Sending command...");

      const response = await fetch(
        "http://localhost:5000/api/devices/control",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            device,
            state,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Device control failed");
      }

      const result = await response.json();

      setAnalysis((previous) => {
        if (!previous) {
          return previous;
        }

        return {
          ...previous,
          devices: {
            ...previous.devices,
            devices: result.devices,
          },
        };
      });

      setControlMessage(
        `${device} turned ${state ? "ON" : "OFF"}`
      );
    } catch (error) {
      console.error("Control error:", error);
      setControlMessage("Unable to control device");
    } finally {
      setControllingDevice(null);

      window.setTimeout(() => {
        setControlMessage("");
      }, 2500);
    }
  };

  // ==========================================================
  // VOICE CONTROL
  // ==========================================================

  const processVoiceCommand = async (rawCommand: string) => {
    const command = rawCommand.toLowerCase().trim();
    setLastVoiceCommand(rawCommand);

    const deviceCommands: Array<{
      phrases: string[];
      device: DeviceName;
      label: string;
    }> = [
      {
        phrases: ["living room light", "living room lights", "hall light", "hall lights"],
        device: "livingRoomLight",
        label: "Living Room Light",
      },
      {
        phrases: ["bedroom light", "bedroom lights"],
        device: "bedroomLight",
        label: "Bedroom Light",
      },
      {
        phrases: ["air conditioner", "ac"],
        device: "airConditioner",
        label: "Air Conditioner",
      },
      {
        phrases: ["television", " tv " , " tv", "tv "],
        device: "television",
        label: "Television",
      },
      {
        phrases: ["smart fan", "fan"],
        device: "smartFan",
        label: "Smart Fan",
      },
    ];

    if (
      command.includes("switch to auto") ||
      command.includes("auto mode") ||
      command === "auto"
    ) {
      await changeMode("AUTO");
      setVoiceMessage("Voice command completed: switched to AUTO mode.");
      return;
    }

    if (
      command.includes("switch to manual") ||
      command.includes("manual mode") ||
      command === "manual"
    ) {
      await changeMode("MANUAL");
      setVoiceMessage("Voice command completed: switched to MANUAL mode.");
      return;
    }

    const requestedState =
      command.includes("turn on") ||
      command.includes("switch on") ||
      command.includes("turn the") && command.includes(" on")
        ? true
        : command.includes("turn off") ||
          command.includes("switch off") ||
          command.includes("turn the") && command.includes(" off")
        ? false
        : null;

    if (requestedState === null) {
      setVoiceMessage(
        'Command not recognised. Try "turn on the living room light" or "switch to manual mode".'
      );
      return;
    }

    const match = deviceCommands.find(({ phrases }) =>
      phrases.some((phrase) => command.includes(phrase.trim()))
    );

    if (!match) {
      setVoiceMessage(
        "I heard the command, but could not identify a supported device. Try saying a device name such as living room light, bedroom light, fan, TV, or AC."
      );
      return;
    }

    try {
      setVoiceBusy(true);
      if (mode !== "MANUAL") {
        await changeMode("MANUAL");
      }

      // Send the device command directly after changing mode. React state updates
      // asynchronously, so the existing button handler may still see the old mode.
      const response = await fetch(
        "http://localhost:5000/api/devices/control",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            device: match.device,
            state: requestedState,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Device control failed");
      }

      await response.json();
      await fetchAIAnalysis();
      setVoiceMessage(
        `${match.label} turned ${requestedState ? "ON" : "OFF"}.`
      );
      setControlMessage(
        `${match.label} turned ${requestedState ? "ON" : "OFF"} by voice`
      );
    } catch (error) {
      console.error("Voice command error:", error);
      setVoiceMessage(
        "Unable to complete that voice command. Check the backend and try again."
      );
    } finally {
      setVoiceBusy(false);
    }
  };

  const startVoiceListening = () => {
    const speechWindow = window as SpeechRecognitionWindow;
    const SpeechRecognitionConstructor =
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;

    if (!SpeechRecognitionConstructor) {
      setVoiceMessage(
        "Voice recognition is not supported by this browser. Try the latest Google Chrome or Microsoft Edge."
      );
      return;
    }

    try {
      const recognition = new SpeechRecognitionConstructor();
      recognition.lang = "en-IN";
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onresult = (event) => {
        const result = event.results[event.resultIndex];
        if (result?.isFinal && result[0]?.transcript) {
          void processVoiceCommand(result[0].transcript);
        }
      };

      recognition.onerror = (event) => {
        setVoiceMessage(
          event.error === "not-allowed"
            ? "Microphone access was blocked. Allow microphone access in your browser's site settings."
            : `Voice recognition error: ${event.error}. Please try again.`
        );
      };

      recognition.onend = () => setIsListening(false);
      recognition.start();
      setIsListening(true);
      setVoiceMessage("Listening... Speak a smart-home command in English.");
    } catch (error) {
      console.error("Unable to start voice recognition:", error);
      setIsListening(false);
      setVoiceMessage("Could not start the microphone. Check browser microphone permission and try again.");
    }
  };

  // ==========================================================
  // START DASHBOARD
  // ==========================================================

  useEffect(() => {
    fetchAIAnalysis();

    const interval = window.setInterval(
      fetchAIAnalysis,
      3000
    );

    return () => window.clearInterval(interval);
  }, []);

  const sensors = analysis?.sensors;
  const ai = analysis?.ai;
  const devices = analysis?.devices;

  // ==========================================================
  // DEVICE CARD
  // ==========================================================

  const renderDevice = (
    device: DeviceName,
    icon: string,
    name: string
  ) => {
    const state = devices?.devices[device] ?? false;
    const isControlling = controllingDevice === device;

    return (
      <div className="device-card" key={device}>
        <div className="device-icon">{icon}</div>

        <div className="device-info">
          <h3>{name}</h3>

          <span className={state ? "device-on" : "device-off"}>
            {state ? "ON" : "OFF"}
          </span>

          <div className="device-controls">
            <button
              className={
                state
                  ? "control-button active"
                  : "control-button"
              }
              disabled={
                mode !== "MANUAL" || isControlling
              }
              onClick={() => controlDevice(device, true)}
            >
              ON
            </button>

            <button
              className={
                !state
                  ? "control-button active-off"
                  : "control-button"
              }
              disabled={
                mode !== "MANUAL" || isControlling
              }
              onClick={() => controlDevice(device, false)}
            >
              OFF
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ==========================================================
  // DASHBOARD
  // ==========================================================

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>🏠 AI Smart Home</h1>
          <p>
            Intelligent Home Monitoring &amp; Automation System
          </p>
        </div>

        <div className="status">
          <span
            className={`status-dot ${
              backendStatus === "Online" ? "online" : "offline"
            }`}
          />
          Backend: {backendStatus}
        </div>
      </header>

      <main>
        {/* WELCOME */}

        <section className="welcome">
          <h2>Smart Home Overview</h2>
          <p>
            Real-time IoT monitoring with machine-learning
            powered home intelligence and automated device
            decisions.
          </p>
        </section>

        {/* SYSTEM MODE */}

        <section className="system-section">
          <h2>⚙️ System Control Mode</h2>

          <div className="actions-card">
            <div className="mode-switch">
              <div>
                <h3>
                  Current Mode:{" "}
                  <strong>{mode}</strong>
                </h3>

                <p>
                  {mode === "AUTO"
                    ? "AI automatically controls your smart devices based on sensor readings."
                    : "You have control of your devices. AI analysis continues, but it will not change device states."}
                </p>
              </div>

              <div className="mode-buttons">
                <button
                  className={
                    mode === "AUTO"
                      ? "control-button active"
                      : "control-button"
                  }
                  disabled={changingMode}
                  onClick={() => changeMode("AUTO")}
                >
                  {changingMode && mode !== "AUTO"
                    ? "Please wait..."
                    : "🤖 AUTO"}
                </button>

                <button
                  className={
                    mode === "MANUAL"
                      ? "control-button active"
                      : "control-button"
                  }
                  disabled={changingMode}
                  onClick={() => changeMode("MANUAL")}
                >
                  {changingMode && mode !== "MANUAL"
                    ? "Please wait..."
                    : "✋ MANUAL"}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* REAL-TIME NOTIFICATIONS */}

        <section className="system-section">
          <h2>🔔 Real-Time Notifications</h2>
          <div className="actions-card">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                flexWrap: "wrap",
                marginBottom: "14px",
              }}
            >
              <p style={{ margin: 0 }}>
                Alerts update automatically with sensor and AI readings.
              </p>
              <button
                className="control-button"
                onClick={() => setAlerts([])}
                disabled={alerts.length === 0}
              >
                Clear all
              </button>
            </div>

            {alerts.length === 0 ? (
              <p className="notification-empty">
                ✅ No new alerts. Monitoring sensor readings...
              </p>
            ) : (
              <div
                className="notification-list"
                style={{ display: "grid", gap: "10px" }}
              >
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`notification-item notification-${alert.severity}`}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: "12px",
                      padding: "12px 14px",
                      borderRadius: "10px",
                      border: "1px solid #dbe2ea",
                    }}
                  >
                    <div>
                      <strong>
                        {alert.severity === "warning" ? "⚠️ " : "ℹ️ "}
                        {alert.title}
                      </strong>
                      <p style={{ margin: "6px 0" }}>{alert.message}</p>
                      <small>{new Date(alert.timestamp).toLocaleTimeString()}</small>
                    </div>
                    <button
                      className="control-button"
                      aria-label={`Dismiss ${alert.title} notification`}
                      onClick={() =>
                        setAlerts((current) =>
                          current.filter((item) => item.id !== alert.id)
                        )
                      }
                    >
                      Dismiss
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* VOICE CONTROL */}

        <section className="system-section">
          <h2>🎙️ Voice Control</h2>
          <div className="actions-card voice-control-card">
            <p className="voice-description">
              Give a short English command to control a device or change the system mode.
              Device commands switch to MANUAL mode first.
            </p>

            <div className="voice-actions">
              <button
                className="control-button voice-start-button"
                onClick={startVoiceListening}
                disabled={isListening || voiceBusy || changingMode}
              >
                {isListening ? "🎙️ Listening..." : "🎤 Start Listening"}
              </button>
            </div>

            <p className="voice-message" role="status" aria-live="polite">
              {voiceMessage}
            </p>

            {lastVoiceCommand && (
              <p className="voice-last-command">
                Last command heard: <strong>{lastVoiceCommand}</strong>
              </p>
            )}

            <div className="voice-examples">
              <strong>Try saying:</strong>
              <ul>
                <li>“Turn on the living room light”</li>
                <li>“Turn off the bedroom light”</li>
                <li>“Turn on the fan”</li>
                <li>“Turn off the TV”</li>
                <li>“Switch to auto mode”</li>
              </ul>
            </div>
          </div>
        </section>

        {/* SENSOR MONITORING */}

        <section className="sensor-grid">
          <div className="sensor-card">
            <div className="sensor-icon">🌡️</div>
            <div>
              <h3>Temperature</h3>
              <strong>
                {sensors ? `${sensors.temperature} °C` : "--"}
              </strong>
            </div>
          </div>

          <div className="sensor-card">
            <div className="sensor-icon">🚶</div>
            <div>
              <h3>Motion</h3>
              <strong>
                {sensors
                  ? sensors.motion
                    ? "Detected"
                    : "No Motion"
                  : "--"}
              </strong>
            </div>
          </div>

          <div className="sensor-card">
            <div className="sensor-icon">💡</div>
            <div>
              <h3>Light Level</h3>
              <strong>
                {sensors ? `${sensors.light}%` : "--"}
              </strong>
            </div>
          </div>

          <div className="sensor-card">
            <div className="sensor-icon">🔊</div>
            <div>
              <h3>Sound Level</h3>
              <strong>
                {sensors ? `${sensors.sound}%` : "--"}
              </strong>
            </div>
          </div>

          <div className="sensor-card occupancy-card">
            <div className="sensor-icon">👥</div>
            <div>
              <h3>Sensor Occupancy</h3>
              <strong>
                {sensors
                  ? sensors.occupancy
                    ? "Occupied"
                    : "Empty"
                  : "--"}
              </strong>
            </div>
          </div>
        </section>

        {/* AI INTELLIGENCE */}

        <section className="system-section">
          <h2>🤖 AI Home Intelligence</h2>

          <div className="intelligence-grid">
            <div className="info-card">
              <span>👥</span>
              <h3>AI Occupancy</h3>
              <strong>
                {ai
                  ? ai.occupancy
                    ? "Occupied"
                    : "Empty"
                  : "--"}
              </strong>
              <p>
                {ai && ai.occupancy_probability !== null
                  ? `Confidence: ${(
                      ai.occupancy_probability * 100
                    ).toFixed(1)}%`
                  : "Waiting for AI prediction..."}
              </p>
            </div>

            <div className="info-card">
              <span>⚡</span>
              <h3>Energy Prediction</h3>
              <strong>
                {ai ? ai.predicted_energy : "--"}
              </strong>
              <p>Relative energy consumption</p>
            </div>

            <div className="info-card">
              <span>🔋</span>
              <h3>Energy Mode</h3>
              <strong>
                {devices ? devices.energyMode : "--"}
              </strong>
              <p>Smart energy management state</p>
            </div>

            <div className="info-card">
              <span>💡</span>
              <h3>AI Recommendation</h3>
              <p>
                {ai
                  ? ai.recommendation
                  : "Waiting for AI analysis..."}
              </p>
            </div>
          </div>
        </section>

        {/* SMART DEVICE CONTROL */}

        <section className="system-section">
          <h2>🏠 Smart Device Control</h2>

          {controlMessage && (
            <div className="control-message">
              ✓ {controlMessage}
            </div>
          )}

          {mode === "AUTO" && (
            <div className="control-message">
              🤖 AUTO mode is active. Switch to MANUAL mode
              to use the device buttons.
            </div>
          )}

          <div className="device-grid">
            {renderDevice(
              "livingRoomLight",
              "💡",
              "Living Room Light"
            )}

            {renderDevice(
              "bedroomLight",
              "🛏️",
              "Bedroom Light"
            )}

            {renderDevice(
              "airConditioner",
              "❄️",
              "Air Conditioner"
            )}

            {renderDevice(
              "television",
              "📺",
              "Television"
            )}

            {renderDevice(
              "smartFan",
              "🌀",
              "Smart Fan"
            )}
          </div>
        </section>

        {/* AUTOMATION ACTIONS */}

        <section className="system-section">
          <h2>🧠 Smart Automation Actions</h2>

          <div className="actions-card">
            {devices?.actions && devices.actions.length > 0 ? (
              devices.actions.map((action, index) => (
                <div className="action-item" key={index}>
                  <span>✓</span>
                  <p>{action}</p>
                </div>
              ))
            ) : (
              <p>Waiting for smart-home decisions...</p>
            )}
          </div>
        </section>

        {/* AI STATUS */}

        <section className="ai-status">
          <div>
            <h2>🧠 AI Engine Status</h2>
            <p>
              Random Forest models are analyzing incoming
              sensor data and generating smart-home decisions.
            </p>
          </div>

          <div className="ai-badge">● AI ACTIVE</div>
        </section>

        {/* FOOTER */}

        {analysis && (
          <footer>
            Last AI analysis: <strong>{lastUpdate}</strong>
          </footer>
        )}
      </main>
    </div>
  );
}

export default App;