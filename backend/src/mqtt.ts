import mqtt from "mqtt";
import crypto from "crypto";
import { pool } from "./db/client";
import { commitTemperatureOnChain } from "./blockchain";

let ioBroadcast: ((event: string, payload: unknown) => void) | undefined;

export function setBroadcast(fn: (event: string, payload: unknown) => void) {
  ioBroadcast = fn;
}

function hashReading(input: string) {
  return "0x" + crypto.createHash("sha256").update(input).digest("hex");
}

export function startMqtt() {
  const client = mqtt.connect(process.env.MQTT_URL || "mqtt://localhost:1883");

  client.on("connect", () => {
    console.log("MQTT connected");
    client.subscribe("bloodchain/delivery/+/temperature");
  });

  client.on("message", async (topic, buffer) => {
    try {
      const payload = JSON.parse(buffer.toString());
      const deliveryCode = topic.split("/")[2];

      const delivery = await pool.query(
        `SELECT id FROM deliveries WHERE delivery_code=$1`,
        [deliveryCode]
      );
      if (!delivery.rowCount) return;

      const temperature = Number(payload.temperatureC);
      const humidity = payload.humidity == null ? null : Number(payload.humidity);
      const recordedAt = payload.timestamp ? new Date(payload.timestamp) : new Date();
      const hash = hashReading(`${deliveryCode}|${payload.deviceId}|${temperature}|${recordedAt.toISOString()}`);

      // Demo threshold. Configure validated limits for the actual blood product/protocol.
      const alert = temperature < 2 || temperature > 6;

      await pool.query(
        `INSERT INTO temperature_readings
          (delivery_id,device_id,temperature_c,humidity,recorded_at,reading_hash,alert)
         VALUES($1,$2,$3,$4,$5,$6,$7)`,
        [delivery.rows[0].id, payload.deviceId || "unknown", temperature, humidity, recordedAt, hash, alert]
      );

      ioBroadcast?.("temperature", {
        deliveryCode,
        temperature,
        humidity,
        recordedAt,
        alert
      });

      // Commit every alert and periodically every 10th reading.
      const count = await pool.query(
        `SELECT count(*)::int AS count FROM temperature_readings WHERE delivery_id=$1`,
        [delivery.rows[0].id]
      );
      if (alert || count.rows[0].count % 10 === 0) {
        try {
          const receipt = await commitTemperatureOnChain(deliveryCode, hash, temperature);
          ioBroadcast?.("blockchain", {
            deliveryCode,
            txHash: receipt.hash
          });
        } catch (chainError) {
          console.warn("Blockchain temperature commitment skipped:", (chainError as Error).message);
        }
      }
    } catch (e) {
      console.warn("Invalid MQTT payload:", (e as Error).message);
    }
  });

  return client;
}
