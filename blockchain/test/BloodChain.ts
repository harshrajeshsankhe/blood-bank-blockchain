import { expect } from "chai";
import { ethers } from "hardhat";

describe("BloodChain", function () {
  async function fixture() {
    const [admin, bank, hospital, transport, stranger] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("BloodChain");
    const contract = await Factory.deploy(admin.address);
    await contract.waitForDeployment();
    await contract.grantOperationalRoles(bank.address, hospital.address, transport.address);
    return { contract, admin, bank, hospital, transport, stranger };
  }

  it("registers a blood unit and prevents duplicate IDs", async function () {
    const { contract, bank } = await fixture();
    const now = Math.floor(Date.now() / 1000);

    await expect(
      contract.connect(bank).registerBloodUnit(
        "BLD-001",
        "O+",
        now,
        now + 86400 * 30,
        ethers.keccak256(ethers.toUtf8Bytes("metadata"))
      )
    ).to.emit(contract, "BloodUnitRegistered");

    await expect(
      contract.connect(bank).registerBloodUnit(
        "BLD-001",
        "O+",
        now,
        now + 86400 * 30,
        ethers.ZeroHash
      )
    ).to.be.revertedWith("UNIT_EXISTS");
  });

  it("creates and updates a delivery", async function () {
    const { contract, bank, transport } = await fixture();
    const now = Math.floor(Date.now() / 1000);

    await contract.connect(bank).registerBloodUnit(
      "BLD-002", "A+", now, now + 100000, ethers.ZeroHash
    );

    await expect(
      contract.connect(bank).createDelivery(
        "DLV-001", "BLD-002", ethers.keccak256(ethers.toUtf8Bytes("manifest"))
      )
    ).to.emit(contract, "DeliveryCreated");

    await expect(
      contract.connect(transport).setDeliveryStatus("DLV-001", 2)
    ).to.emit(contract, "DeliveryStatusChanged");
  });

  it("blocks unauthorized actors", async function () {
    const { contract, stranger } = await fixture();
    const now = Math.floor(Date.now() / 1000);

    await expect(
      contract.connect(stranger).registerBloodUnit(
        "BLD-X", "O+", now, now + 1000, ethers.ZeroHash
      )
    ).to.be.reverted;
  });

  it("records a temperature commitment", async function () {
    const { contract, bank, transport } = await fixture();
    const now = Math.floor(Date.now() / 1000);

    await contract.connect(bank).registerBloodUnit(
      "BLD-003", "B+", now, now + 100000, ethers.ZeroHash
    );
    await contract.connect(bank).createDelivery("DLV-003", "BLD-003", ethers.ZeroHash);

    await expect(
      contract.connect(transport).commitTemperature(
        "DLV-003",
        ethers.keccak256(ethers.toUtf8Bytes("4.8|2026-01-01")),
        48
      )
    ).to.emit(contract, "TemperatureCommitment");
  });
});
