# BloodChain — Blockchain + IoT Blood Bank Management

A runnable educational/academic prototype for blood donation, inventory, hospital requests,
allocation, dispatch, delivery tracking, IoT temperature monitoring, QR tracking and
blockchain verification.

> Safety note: this system is an information/traceability prototype. It does not determine
> clinical suitability of blood, replace blood-bank SOPs, or certify a shipment as safe.
> Temperature thresholds must be configured according to the applicable validated protocol.

## Stack

- React + Vite + TypeScript
- Express + TypeScript
- PostgreSQL
- Solidity + Hardhat
- ethers.js
- MetaMask/browser wallet
- MQTT (Mosquitto)
- ESP32 + DHT11/DHT22-compatible sketch
- QR generation/scanning
- Docker Compose for PostgreSQL + MQTT

## Architecture

```text
ESP32 + DHT11
      |
      | MQTT
      v
Mosquitto ---> Backend ---> PostgreSQL
                  |
                  +----> Smart Contract (Hardhat / EVM)
                  |
                  +----> WebSocket ---> React Dashboard
                                         |
                                         +--> MetaMask
                                         +--> QR Scanner
```

High-frequency sensor readings stay in PostgreSQL. Important lifecycle events and hashes are
recorded on-chain. This avoids writing every sensor sample to the blockchain.

## Prerequisites

- Node.js 20+
- npm 10+
- Docker Desktop
- MetaMask
- Optional: physical ESP32 + DHT11
- Optional: Python 3 for a simple local sensor simulator

## 1. Install

From the repository root:

```bash
npm install
npm run install:all
```

## 2. Start infrastructure

```bash
docker compose up -d postgres mqtt
```

PostgreSQL:
- host: localhost
- port: 5432
- database: bloodchain
- user: bloodchain
- password: bloodchain

MQTT:
- host: localhost
- port: 1883

## 3. Start local blockchain

Terminal 1:

```bash
cd blockchain
npm install
npm run node
```

Keep this terminal running. The contract uses Hardhat's local deterministic accounts; the backend uses the local blood-bank account only. Never use these keys outside local development.

Terminal 2:

```bash
cd blockchain
npm run deploy:local
```

The deployment writes the contract address to:

```text
backend/.env.local
frontend/.env.local
```

## 4. Configure backend

Copy the example environment:

```bash
cp backend/.env.example backend/.env
```

The local defaults work with the Docker PostgreSQL/MQTT services.

Then:

```bash
cd backend
npm install
npm run db:migrate
npm run seed
npm run dev
```

Backend:
http://localhost:4000

Health:
http://localhost:4000/health

## 5. Start frontend

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open:
http://localhost:5173

## 6. MetaMask local network

In MetaMask add:

```text
Network name: BloodChain Local
RPC URL: http://127.0.0.1:8545
Chain ID: 31337
Currency symbol: ETH
```

Import one of the private keys printed by `npx hardhat node` into MetaMask.
Use only local Hardhat accounts. Never use a real wallet private key.

## 7. Demo accounts

The seed script creates:

```text
Admin:
admin@bloodchain.local
password: Admin123!

Blood bank:
bank@bloodchain.local
password: Bank123!

Hospital:
hospital@bloodchain.local
password: Hospital123!

Transport:
transport@bloodchain.local
password: Transport123!
```

These are development credentials only.

## 8. Run everything

After infrastructure and deployment:

```bash
npm run dev
```

This launches backend and frontend together.

## 9. IoT simulator

Without hardware, run:

```bash
cd iot/simulator
npm install
npm start
```

It publishes simulated DHT11-like readings to:

```text
bloodchain/delivery/<DELIVERY_ID>/temperature
```

The backend will store readings, calculate alert state, and push live updates to the dashboard.

## 10. Physical ESP32

Open:

```text
iot/esp32/bloodchain_dht11.ino
```

Set:

- Wi-Fi SSID/password
- MQTT broker IP
- delivery ID
- DHT pin

The ESP32 publishes JSON:

```json
{
  "deviceId": "ESP32-001",
  "deliveryId": "DLV-...",
  "temperatureC": 4.8,
  "humidity": 63.2,
  "timestamp": "2026-09-25T00:00:00.000Z"
}
```

For a phone hotspot/LAN, the MQTT broker must be reachable from the ESP32's network.

## Main workflow

1. Blood bank registers blood unit.
2. Blood unit receives a unique ID and QR code.
3. Hospital creates a request.
4. Blood bank allocates a compatible unit.
5. Delivery is approved and dispatched.
6. Delivery gets a QR tracking URL.
7. ESP32/DHT11 sends temperature readings.
8. Backend stores readings and generates alerts.
9. Important lifecycle events are written to the smart contract.
10. Dashboard displays delivery status and live temperature.
11. Blockchain verification page reads the on-chain lifecycle events.

## API

Authentication:
- `POST /api/auth/login`

Blood:
- `POST /api/blood-units`
- `GET /api/blood-units`
- `GET /api/blood-units/:id`

Requests:
- `POST /api/requests`
- `GET /api/requests`

Deliveries:
- `POST /api/deliveries`
- `POST /api/deliveries/:id/status`
- `GET /api/deliveries/:id`

IoT:
- `GET /api/deliveries/:id/temperature`
- MQTT topic: `bloodchain/delivery/<deliveryId>/temperature`

Blockchain:
- `GET /api/blockchain/verify/:bloodUnitId`

## Testing

The repository includes GitHub Actions CI for contract tests, backend tests, and the frontend production build. Generate lockfiles with the install commands before relying on npm cache settings in CI.


Smart contract:

```bash
cd blockchain
npm test
```

Backend:

```bash
cd backend
npm test
```

Frontend:

```bash
cd frontend
npm run build
```

## Production deployment

Recommended production architecture:

```text
React -> Vercel/Cloudflare
Express -> Render/Fly.io/AWS
PostgreSQL -> managed PostgreSQL
MQTT -> managed MQTT broker
Blockchain -> Ethereum-compatible testnet/mainnet
ESP32 -> TLS MQTT
```

Before production:
- replace local passwords/secrets
- use TLS
- use managed database
- use wallet-based organizational identities
- add audit logging and key management
- validate storage/transport thresholds with qualified blood-bank personnel
- never put donor PII on a public blockchain
- encrypt sensitive application data
- add rate limiting and CSRF/CORS controls
- use a proper secrets manager

## Repository structure

```text
blood-bank-blockchain/
├── blockchain/
├── backend/
├── frontend/
├── iot/
├── docker-compose.yml
├── package.json
└── README.md
```
