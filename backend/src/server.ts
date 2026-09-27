import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local" });

import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import http from "http";
import { WebSocketServer } from "ws";
import { pool } from "./db/client";
import { auth, roles, AuthedRequest } from "./middleware/auth";
import { createDeliveryOnChain, getVerification, registerBloodUnitOnChain, setDeliveryStatusOnChain, setBloodStatusOnChain } from "./blockchain";
import { setBroadcast, startMqtt } from "./mqtt";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:5173" }));
app.use(express.json());

function broadcast(event: string, payload: unknown) {
  const message = JSON.stringify({ event, payload });
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(message);
  });
}
setBroadcast(broadcast);

app.get("/health", (_req, res) => res.json({ ok: true, service: "bloodchain-api" }));

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const result = await pool.query(
    `SELECT id,email,name,role,password_hash FROM users WHERE email=$1`,
    [email]
  );
  if (!result.rowCount || !(await bcrypt.compare(password, result.rows[0].password_hash))) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const user = {
    id: result.rows[0].id,
    email: result.rows[0].email,
    name: result.rows[0].name,
    role: result.rows[0].role
  };
  const token = jwt.sign(user, process.env.JWT_SECRET || "dev-secret-change-me", { expiresIn: "12h" });
  res.json({ token, user });
});

app.get("/api/me", auth, (req: AuthedRequest, res) => res.json(req.user));

app.get("/api/dashboard", auth, async (_req, res) => {
  const [units, requests, deliveries, alerts] = await Promise.all([
    pool.query(`SELECT count(*)::int AS n FROM blood_units WHERE status='AVAILABLE'`),
    pool.query(`SELECT count(*)::int AS n FROM blood_requests WHERE status='REQUESTED'`),
    pool.query(`SELECT count(*)::int AS n FROM deliveries WHERE status IN ('DISPATCHED','IN_TRANSIT')`),
    pool.query(`SELECT count(*)::int AS n FROM temperature_readings WHERE alert=true AND recorded_at > now()-interval '24 hours'`)
  ]);
  res.json({
    availableUnits: units.rows[0].n,
    pendingRequests: requests.rows[0].n,
    activeDeliveries: deliveries.rows[0].n,
    alerts24h: alerts.rows[0].n
  });
});

app.get("/api/blood-units", auth, async (_req, res) => {
  const result = await pool.query(
    `SELECT * FROM blood_units ORDER BY created_at DESC LIMIT 200`
  );
  res.json(result.rows);
});

app.get("/api/blood-units/:id", auth, async (req, res) => {
  const result = await pool.query(`SELECT * FROM blood_units WHERE unit_code=$1`, [req.params.id]);
  if (!result.rowCount) return res.status(404).json({ error: "Blood unit not found" });
  res.json(result.rows[0]);
});

app.post("/api/blood-units", auth, roles("ADMIN", "BLOOD_BANK"), async (req: AuthedRequest, res) => {
  const {
    bloodGroup,
    donorReference,
    donatedAt = new Date().toISOString(),
    expiresAt
  } = req.body;

  const unitCode = `BLD-${new Date().getFullYear()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  const metadataHash = "0x" + crypto
    .createHash("sha256")
    .update(JSON.stringify({ unitCode, bloodGroup, donatedAt, expiresAt }))
    .digest("hex");

  const inserted = await pool.query(
    `INSERT INTO blood_units(unit_code,blood_group,donor_reference,donated_at,expires_at,metadata_hash)
     VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
    [unitCode, bloodGroup, donorReference || null, donatedAt, expiresAt, metadataHash]
  );

  try {
    const receipt = await registerBloodUnitOnChain(
      unitCode,
      bloodGroup,
      new Date(donatedAt),
      new Date(expiresAt),
      metadataHash
    );
    await pool.query(`UPDATE blood_units SET blockchain_tx=$1 WHERE unit_code=$2`, [receipt.hash, unitCode]);
  } catch (e) {
    console.warn("Blockchain registration failed:", (e as Error).message);
  }

  await pool.query(
    `INSERT INTO audit_events(entity_type,entity_id,action,actor_id,metadata)
     VALUES('BLOOD_UNIT',$1,'REGISTERED',$2,$3)`,
    [unitCode, req.user!.id, JSON.stringify({ bloodGroup })]
  );

  res.status(201).json(inserted.rows[0]);
});

app.get("/api/requests", auth, async (_req, res) => {
  const result = await pool.query(`
    SELECT br.*, u.name AS hospital_name
    FROM blood_requests br
    LEFT JOIN users u ON u.id=br.hospital_id
    ORDER BY br.created_at DESC
  `);
  res.json(result.rows);
});

app.post("/api/requests", auth, roles("HOSPITAL", "ADMIN"), async (req: AuthedRequest, res) => {
  const { bloodGroup, quantity, urgency = "ROUTINE" } = req.body;
  const code = `REQ-${new Date().getFullYear()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  const result = await pool.query(
    `INSERT INTO blood_requests(request_code,hospital_id,blood_group,quantity,urgency)
     VALUES($1,$2,$3,$4,$5) RETURNING *`,
    [code, req.user!.id, bloodGroup, quantity, urgency]
  );
  res.status(201).json(result.rows[0]);
});

app.get("/api/deliveries", auth, async (_req, res) => {
  const result = await pool.query(`
    SELECT d.*, bu.unit_code, bu.blood_group
    FROM deliveries d
    JOIN blood_units bu ON bu.id=d.blood_unit_id
    ORDER BY d.updated_at DESC
  `);
  res.json(result.rows);
});

app.get("/api/deliveries/:id", auth, async (req, res) => {
  const result = await pool.query(`
    SELECT d.*, bu.unit_code, bu.blood_group
    FROM deliveries d
    JOIN blood_units bu ON bu.id=d.blood_unit_id
    WHERE d.delivery_code=$1
  `, [req.params.id]);
  if (!result.rowCount) return res.status(404).json({ error: "Delivery not found" });

  const readings = await pool.query(
    `SELECT * FROM temperature_readings WHERE delivery_id=$1 ORDER BY recorded_at DESC LIMIT 100`,
    [result.rows[0].id]
  );
  res.json({ ...result.rows[0], readings: readings.rows });
});

app.post("/api/deliveries", auth, roles("ADMIN", "BLOOD_BANK"), async (req: AuthedRequest, res) => {
  const { bloodUnitId, requestId, origin, destination } = req.body;
  const unit = await pool.query(`SELECT * FROM blood_units WHERE unit_code=$1`, [bloodUnitId]);
  if (!unit.rowCount) return res.status(404).json({ error: "Blood unit not found" });

  const code = `DLV-${new Date().getFullYear()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  const manifestHash = "0x" + crypto
    .createHash("sha256")
    .update(JSON.stringify({ code, bloodUnitId, requestId, origin, destination }))
    .digest("hex");

  const result = await pool.query(
    `INSERT INTO deliveries(delivery_code,blood_unit_id,request_id,origin,destination)
     VALUES($1,$2,$3,$4,$5) RETURNING *`,
    [code, unit.rows[0].id, requestId || null, origin, destination]
  );

  await pool.query(`UPDATE blood_units SET status='ALLOCATED' WHERE unit_code=$1`, [bloodUnitId]);

  try {
    const receipt = await createDeliveryOnChain(code, bloodUnitId, manifestHash);
    await pool.query(`UPDATE deliveries SET blockchain_tx=$1 WHERE delivery_code=$2`, [receipt.hash, code]);
  } catch (e) {
    console.warn("Blockchain delivery creation failed:", (e as Error).message);
  }

  res.status(201).json(result.rows[0]);
});

app.post("/api/deliveries/:id/status", auth, roles("ADMIN", "BLOOD_BANK", "TRANSPORT", "HOSPITAL"), async (req: AuthedRequest, res) => {
  const { status } = req.body;
  const allowed = ["REQUESTED","APPROVED","DISPATCHED","IN_TRANSIT","DELIVERED","CANCELLED"];
  if (!allowed.includes(status)) return res.status(400).json({ error: "Invalid status" });

  const result = await pool.query(
    `UPDATE deliveries SET status=$1,updated_at=now() WHERE delivery_code=$2 RETURNING *`,
    [status, req.params.id]
  );
  if (!result.rowCount) return res.status(404).json({ error: "Delivery not found" });

  if (status === "DISPATCHED") {
    await pool.query(`UPDATE blood_units bu SET status='DISPATCHED'
      FROM deliveries d WHERE d.blood_unit_id=bu.id AND d.delivery_code=$1`, [req.params.id]);
  }
  if (status === "DELIVERED") {
    await pool.query(`UPDATE blood_units bu SET status='DELIVERED'
      FROM deliveries d WHERE d.blood_unit_id=bu.id AND d.delivery_code=$1`, [req.params.id]);
  }

  // Keep the blockchain lifecycle synchronized with the application lifecycle.
  const chainStatus: Record<string, number> = {
    REQUESTED: 0,
    APPROVED: 1,
    DISPATCHED: 2,
    IN_TRANSIT: 3,
    DELIVERED: 4,
    CANCELLED: 5
  };
  try {
    const receipt = await setDeliveryStatusOnChain(req.params.id, chainStatus[status]);
    await pool.query(
      `UPDATE deliveries SET blockchain_tx=$1 WHERE delivery_code=$2`,
      [receipt.hash, req.params.id]
    );
  } catch (e) {
    console.warn("Blockchain status update failed:", (e as Error).message);
  }

  res.json(result.rows[0]);
});

app.get("/api/deliveries/:id/temperature", auth, async (req, res) => {
  const result = await pool.query(`
    SELECT tr.* FROM temperature_readings tr
    JOIN deliveries d ON d.id=tr.delivery_id
    WHERE d.delivery_code=$1
    ORDER BY tr.recorded_at DESC LIMIT 200
  `, [req.params.id]);
  res.json(result.rows);
});

app.get("/api/blockchain/verify/:id", auth, async (req, res) => {
  try {
    const result = await getVerification(req.params.id);
    res.json(result);
  } catch (e) {
    res.status(404).json({ error: "No blockchain record found", detail: (e as Error).message });
  }
});

startMqtt();

const port = Number(process.env.PORT || 4000);
server.listen(port, () => {
  console.log(`BloodChain API listening on http://localhost:${port}`);
});
