
export interface SensorData {
  timestamp: string;
  temperature: number;
  motion: boolean;
  light: number;
  sound: number;
  occupancy: boolean;
}

export function generateSensorData(): SensorData {
  const temperature = Number(
    (20 + Math.random() * 15).toFixed(2)
  );

  const motion = Math.random() > 0.5;

  const light = Math.floor(Math.random() * 100);

  const sound = Math.floor(Math.random() * 100);

  const occupancy = motion || sound > 45;

  return {
    timestamp: new Date().toISOString(),
    temperature,
    motion,
    light,
    sound,
    occupancy,
  };
}