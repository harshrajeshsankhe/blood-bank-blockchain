import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  const [deployer, bloodBank, hospital, transporter] = await ethers.getSigners();

  const Factory = await ethers.getContractFactory("BloodChain");
  const contract = await Factory.deploy(deployer.address);
  await contract.waitForDeployment();

  await (
    await contract.grantOperationalRoles(
      bloodBank.address,
      hospital.address,
      transporter.address
    )
  ).wait();

  const address = await contract.getAddress();
  console.log(`BloodChain deployed: ${address}`);
  console.log(`Admin: ${deployer.address}`);
  console.log(`Blood bank: ${bloodBank.address}`);
  console.log(`Hospital: ${hospital.address}`);
  console.log(`Transport: ${transporter.address}`);

  const artifact = await ethers.getContractFactory("BloodChain");
  const abi = artifact.interface.formatJson();

  const backendEnv = path.resolve("../backend/.env.local");
  const frontendEnv = path.resolve("../frontend/.env.local");

  // Hardhat's default mnemonic is deterministic; account #1 key is used only for local development.
  const localBloodBankKey =
    "0x59c6995e998f97a5a0044976f0945389dc9e86dae88c7a6c9a0e7d3b5b0f4b7f";
  fs.writeFileSync(
    backendEnv,
    `BLOCKCHAIN_RPC_URL=http://127.0.0.1:8545\nBLOODCHAIN_CONTRACT=${address}\nBLOODCHAIN_BLOOD_BANK_KEY=${localBloodBankKey}\n`
  );

  fs.writeFileSync(
    path.resolve("../frontend/src/contract-abi.json"),
    abi
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
