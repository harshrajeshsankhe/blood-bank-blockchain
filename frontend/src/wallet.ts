import { ethers } from "ethers";

export async function connectWallet() {
  const eth = (window as any).ethereum;
  if (!eth) throw new Error("MetaMask is not installed.");

  const provider = new ethers.BrowserProvider(eth);
  await provider.send("eth_requestAccounts", []);
  const network = await provider.getNetwork();

  if (network.chainId !== BigInt(31337)) {
    throw new Error("Switch MetaMask to BloodChain Local (chain ID 31337).");
  }

  const signer = await provider.getSigner();
  return {
    address: await signer.getAddress(),
    chainId: Number(network.chainId)
  };
}
