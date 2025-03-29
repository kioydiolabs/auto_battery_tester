import mqtt from "mqtt";
import { csvRow, mqttMessage } from "./types";
import * as fs from "fs";
import * as fastCsv from "fast-csv";
import * as net from "node:net";

// config

const undervoltageProtection: number = 0.9;
const testName: string = "";
const linesBeforeTest: number = 10;

// end of config

const filename = testName + ".csv";

const stream = fs.createWriteStream(filename);
const csvStream = fastCsv.format<csvRow, csvRow>({ headers: true });

csvStream.pipe(stream);

let msgcount: number = 0;
let msgCountAfterUVP: number = 0;
let UVP: boolean = false;

const client = mqtt.connect("mqtt://192.168.1.216", {
  username: "admin",
  password: "knag",
  clientId: "auto_test",
});

client.on("connect", () => {
  console.log("Connected to client!");

  try {
    client.subscribe("station/70/sensordata/ds18b20");
  } catch (err) {
    console.error(err);
  }
});

const getMeasurementFromScope = async (channel: string): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    const socket = new net.Socket();
    socket.connect({ host: "192.168.1.28", port: 5555 });
    socket.setEncoding("utf8");
    socket.on("connect", () => {
      socket.write(`MEASure:ITEM? VAVG,${channel}\n`);
    });

    socket.on("data", (data) => {
      resolve(data.toString());
      socket.destroy();
    });

    socket.on("error", (err) => {
      reject(err); // Reject the promise if there's an error
    });
  });
};

client.on("message", async (_, message) => {
  const jsonMSG: mqttMessage = JSON.parse(message.toString());

  msgcount = msgcount + 1;

  const currentString = await getMeasurementFromScope("CHAN4");
  const voltageString = await getMeasurementFromScope("CHAN3");

  const current = parseFloat(currentString);
  const voltage = parseFloat(voltageString);

  const logEntry: csvRow = {
    time: new Date().toISOString(),
    current: current || 0,
    voltage: voltage || 0,
    temperature: jsonMSG.deg_c || 0,
    relay: jsonMSG.relay,
  };

  try {
    csvStream.write(logEntry);
  } catch (err) {
    console.error(err);
  }

  if (msgcount == linesBeforeTest) {
    client.publish("station/70/commands", "RELAY_ON");
  }
  try {
    if (voltage < undervoltageProtection) {
      client.publish("station/70/commands", "RELAY_OFF");
      UVP = true;
      throw new Error(
        `Undervoltage Protection: The last battery voltage recorded by the oscilloscope on CH3 was ${voltage}V which is under the ${undervoltageProtection}V limit, so the relay was turned off to prevent damage to the battery. The program will now continue to log 60 more lines of data.`,
      );
    }
  } catch (err) {
    console.error(err);
  }

  if (UVP === true) {
    msgCountAfterUVP = msgCountAfterUVP + 1;
    if (!(msgCountAfterUVP >= 60)) {
      console.log("Going offline");
      process.exit(9999);
    }
  }
});
