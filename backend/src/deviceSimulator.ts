
// ============================================================
// SMART DEVICE SIMULATOR
// ============================================================

export interface DeviceState {
  livingRoomLight: boolean;
  bedroomLight: boolean;
  airConditioner: boolean;
  television: boolean;
  smartFan: boolean;
}

export interface DeviceDecision {
  devices: DeviceState;
  actions: string[];
  energyMode: string;
}

export type SystemMode = "AUTO" | "MANUAL";


// ============================================================
// INITIAL SYSTEM MODE
// ============================================================

let systemMode: SystemMode = "AUTO";

export function getSystemMode(): SystemMode {
  return systemMode;
}

export function setSystemMode(mode: SystemMode): SystemMode {
  systemMode = mode;
  return systemMode;
}


// ============================================================
// INITIAL DEVICE STATE
// ============================================================

let deviceState: DeviceState = {
  livingRoomLight: false,
  bedroomLight: false,
  airConditioner: false,
  television: false,
  smartFan: false,
};


// ============================================================
// GET CURRENT DEVICE STATE
// ============================================================

export function getDeviceState(): DeviceState {
  return {
    ...deviceState,
  };
}


// ============================================================
// MANUAL DEVICE CONTROL
// ============================================================

export function setDeviceState(
  device: keyof DeviceState,
  state: boolean
): DeviceState {
  deviceState[device] = state;

  return {
    ...deviceState,
  };
}


// ============================================================
// SMART DEVICE DECISION ENGINE
// ============================================================

export function generateDeviceDecisions(
  temperature: number,
  motion: boolean,
  light: number,
  sound: number,
  occupancy: boolean
): DeviceDecision {

  const actions: string[] = [];

  // ----------------------------------------------------------
  // ENERGY MODE
  // ----------------------------------------------------------

  let energyMode = "NORMAL";

  if (!occupancy) {
    energyMode = "ENERGY SAVING";
  } else if (temperature >= 30 || light < 20) {
    energyMode = "HIGH USAGE";
  } else {
    energyMode = "OPTIMIZED";
  }


  // ----------------------------------------------------------
  // MANUAL MODE
  // AI DOES NOT CHANGE DEVICE STATES
  // ----------------------------------------------------------

  if (systemMode === "MANUAL") {
    actions.push(
      "Manual mode is active. AI recommendations are available, but device states are controlled by the user."
    );

    return {
      devices: {
        ...deviceState,
      },
      actions,
      energyMode,
    };
  }


  // ----------------------------------------------------------
  // AUTO MODE — AI CONTROLS DEVICES
  // ----------------------------------------------------------

  // LIVING ROOM LIGHT

  if (occupancy && light < 35) {
    deviceState.livingRoomLight = true;

    actions.push(
      "Living room light turned ON because the home is occupied and light level is low."
    );
  } else {
    deviceState.livingRoomLight = false;

    actions.push(
      "Living room light turned OFF to reduce unnecessary energy usage."
    );
  }


  // BEDROOM LIGHT

  if (occupancy && light < 20 && !motion) {
    deviceState.bedroomLight = true;

    actions.push(
      "Bedroom light maintained for low-light conditions."
    );
  } else {
    deviceState.bedroomLight = false;
  }


  // AIR CONDITIONER

  if (occupancy && temperature >= 28) {
    deviceState.airConditioner = true;

    actions.push(
      "Air conditioner enabled because temperature is high and the home is occupied."
    );
  } else {
    deviceState.airConditioner = false;

    if (!occupancy) {
      actions.push(
        "Air conditioner turned OFF because the home appears empty."
      );
    } else {
      actions.push(
        "Air conditioner remains OFF because temperature is within the acceptable range."
      );
    }
  }


  // TELEVISION

  if (occupancy && sound > 50 && motion) {
    deviceState.television = true;

    actions.push(
      "Television activity simulated because motion and sound indicate active occupancy."
    );
  } else {
    deviceState.television = false;
  }


  // SMART FAN

  if (occupancy && temperature >= 25) {
    deviceState.smartFan = true;

    actions.push(
      "Smart fan enabled for occupant comfort."
    );
  } else {
    deviceState.smartFan = false;
  }


  return {
    devices: {
      ...deviceState,
    },
    actions,
    energyMode,
  };
}