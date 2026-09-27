const mqtt = require("mqtt");

const broker = process.env.MQTT_URL || "mqtt://localhost:1883";
const delivery = process.env.DELIVERY_ID || "DLV-DEMO-001";
const deviceId = process.env.DEVICE_ID || "ESP32-SIM-001";
const client = mqtt.connect(broker);

client.on("connect", () => {
  console.log(`Publishing temperature data for ${delivery}`);
  setInterval(() => {
    // Keep most readings in the normal demo range and occasionally generate an excursion.
    const excursion = Math.random() < 0.08;
    const temperatureC = excursion
      ? (Math.random() < 0.5 ? 1.2 + Math.random() : 6.8 + Math.random() * 1.8)
      : 3.5 + Math.random() * 2.0;
    const payload = {
      deviceId,
      deliveryId: delivery,
      temperatureC: Number(temperatureC.toFixed(2)),
      humidity: Number((55 + Math.random() * 20).toFixed(1)),
      timestamp: new Date().toISOString()
    };
    client.publish(`bloodchain/delivery/${delivery}/temperature`, JSON.stringify(payload));
    console.log(payload);
  }, 5000);
});
