import bcrypt from "bcryptjs";
import { pool } from "./client";

const users = [
  ["admin@bloodchain.local", "Admin User", "ADMIN", "Admin123!"],
  ["bank@bloodchain.local", "Blood Bank Operator", "BLOOD_BANK", "Bank123!"],
  ["hospital@bloodchain.local", "Hospital Operator", "HOSPITAL", "Hospital123!"],
  ["transport@bloodchain.local", "Transport Operator", "TRANSPORT", "Transport123!"]
];

async function main() {
  for (const [email, name, role, password] of users) {
    const hash = await bcrypt.hash(password, 12);
    await pool.query(
      `INSERT INTO users(email,name,role,password_hash)
       VALUES($1,$2,$3,$4)
       ON CONFLICT(email) DO UPDATE SET name=EXCLUDED.name, role=EXCLUDED.role, password_hash=EXCLUDED.password_hash`,
      [email, name, role, hash]
    );
  }

  const bank = await pool.query(`SELECT id FROM users WHERE email='bank@bloodchain.local'`);
  const hospital = await pool.query(`SELECT id FROM users WHERE email='hospital@bloodchain.local'`);

  const existing = await pool.query(`SELECT id FROM blood_units WHERE unit_code='BLD-DEMO-001'`);
  if (!existing.rowCount) {
    const now = new Date();
    const expiry = new Date(now.getTime() + 30 * 86400000);
    await pool.query(
      `INSERT INTO blood_units(unit_code,blood_group,donor_reference,donated_at,expires_at)
       VALUES($1,$2,$3,$4,$5)`,
      ["BLD-DEMO-001", "O+", "DONOR-DEMO-001", now, expiry]
    );
  }

  console.log("Seed complete.");
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
