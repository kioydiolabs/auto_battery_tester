import mqtt from 'mqtt';

let msgcount: number = 0;

const client = mqtt.connect("mqtt://192.168.1.216", {
  username: "admin",
  password: "knag",
  clientId: "auto_test"
})

client.on('connect', () => {
  console.log("Connected to client!");

  try{
    client.subscribe("station/70/sensordata/ds18b20");
  } catch (err) {
    console.error(err);
  }
})

