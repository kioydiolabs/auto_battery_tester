export type mqttMessage = {
  "deg_c": number;
  "deg_f": number;
  "humidity": number;
  "relay": boolean;
}

export type csvRow = {
  time: string;
  voltage: number;
  current: number;
  relay: boolean;
  temperature: number;
}