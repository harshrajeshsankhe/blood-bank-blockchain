import pg from "pg";
import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});
