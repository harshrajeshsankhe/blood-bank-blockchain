import fs from "fs";
import path from "path";
import { ethers } from "ethers";

const ABI_PATH = path.resolve(__dirname, "../../frontend/src/contract-abi.json");

function provider() {
  return new ethers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC_URL || "http://127.0.0.1:8545");
}

function contract() {
  const abi = JSON.parse(fs.readFileSync(ABI_PATH, "utf8"));
  return new ethers.Contract(
    process.env.BLOODCHAIN_CONTRACT!,
    abi,
    provider()
  );
}

function signerContract() {
  const abi = JSON.parse(fs.readFileSync(ABI_PATH, "utf8"));
  const wallet = new ethers.Wallet(process.env.BLOODCHAIN_BLOOD_BANK_KEY!, provider());
  return new ethers.Contract(process.env.BLOODCHAIN_CONTRACT!, abi, wallet);
}

export async function registerBloodUnitOnChain(
  unitId: string,
  bloodGroup: string,
  donatedAt: Date,
  expiresAt: Date,
  metadataHash: string
) {
  const c = signerContract();
  const tx = await c.registerBloodUnit(
    unitId,
    bloodGroup,
    Math.floor(donatedAt.getTime() / 1000),
    Math.floor(expiresAt.getTime() / 1000),
    metadataHash
  );
  return tx.wait();
}

export async function createDeliveryOnChain(
  deliveryId: string,
  unitId: string,
  manifestHash: string
) {
  const c = signerContract();
  const tx = await c.createDelivery(deliveryId, unitId, manifestHash);
  return tx.wait();
}

export async function commitTemperatureOnChain(
  deliveryId: string,
  readingHash: string,
  temperatureC: number
) {
  const c = signerContract();
  const deci = Math.round(temperatureC * 10);
  const tx = await c.commitTemperature(deliveryId, readingHash, deci);
  return tx.wait();
}

export async function getVerification(unitId: string) {
  const c = contract();
  const unit = await c.getBloodUnit(unitId);
  const filter = c.filters.BloodUnitRegistered(unitId);
  const events = await c.queryFilter(filter);
  return {
    unit: {
      unitId: unit.unitId,
      bloodGroup: unit.bloodGroup,
      donatedAt: Number(unit.donatedAt),
      expiresAt: Number(unit.expiresAt),
      status: Number(unit.status),
      metadataHash: unit.metadataHash,
      createdBy: unit.createdBy
    },
    events: events.map((e: any) => ({
      blockNumber: e.blockNumber,
      transactionHash: e.transactionHash,
      event: e.fragment?.name || "BloodUnitRegistered"
    }))
  };
}

export async function setDeliveryStatusOnChain(deliveryId: string, status: number) {
  const c = signerContract();
  const tx = await c.setDeliveryStatus(deliveryId, status);
  return tx.wait();
}

export async function setBloodStatusOnChain(unitId: string, status: number) {
  const c = signerContract();
  const tx = await c.setBloodStatus(unitId, status);
  return tx.wait();
}
