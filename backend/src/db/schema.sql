CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ADMIN','BLOOD_BANK','HOSPITAL','TRANSPORT','DONOR')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS blood_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_code TEXT UNIQUE NOT NULL,
  blood_group TEXT NOT NULL,
  donor_reference TEXT,
  donated_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'AVAILABLE',
  metadata_hash TEXT,
  blockchain_tx TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS blood_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_code TEXT UNIQUE NOT NULL,
  hospital_id UUID REFERENCES users(id),
  blood_group TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  urgency TEXT NOT NULL DEFAULT 'ROUTINE',
  status TEXT NOT NULL DEFAULT 'REQUESTED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_code TEXT UNIQUE NOT NULL,
  blood_unit_id UUID REFERENCES blood_units(id),
  request_id UUID REFERENCES blood_requests(id),
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'REQUESTED',
  blockchain_tx TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS temperature_readings (
  id BIGSERIAL PRIMARY KEY,
  delivery_id UUID REFERENCES deliveries(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  temperature_c NUMERIC(6,2) NOT NULL,
  humidity NUMERIC(6,2),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reading_hash TEXT NOT NULL,
  alert BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS audit_events (
  id BIGSERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor_id UUID REFERENCES users(id),
  blockchain_tx TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_temperature_delivery_time
ON temperature_readings(delivery_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_entity
ON audit_events(entity_type, entity_id, created_at DESC);
