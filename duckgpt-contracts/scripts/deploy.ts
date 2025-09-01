import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Starting complete deployment with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  const deployedContracts: { [key: string]: string } = {};

  // 1. Deploy DuckToken (no dependencies)
  console.log("\n1. Deploying DuckToken...");
  const DuckToken = await ethers.getContractFactory("DuckToken");
  const initialSupply = 1000000; // 1 million tokens
  const duckToken = await DuckToken.deploy(initialSupply, deployer.address);
  await duckToken.waitForDeployment();
  deployedContracts.DuckToken = await duckToken.getAddress();
  console.log("✓ DuckToken deployed to:", deployedContracts.DuckToken);


  // 2. Deploy PluginRegistry (depends on DuckToken)
  console.log("\n2. Deploying PluginRegistry...");
  const PluginRegistry = await ethers.getContractFactory("PluginRegistry");
  const pluginRegistry = await PluginRegistry.deploy(deployedContracts.DuckToken, deployer.address);
  await pluginRegistry.waitForDeployment();
  deployedContracts.PluginRegistry = await pluginRegistry.getAddress();
  console.log("✓ PluginRegistry deployed to:", deployedContracts.PluginRegistry);

  // 3. Deploy UsageMeter (depends on DuckToken and PluginRegistry)
  console.log("\n3. Deploying UsageMeter...");
  const UsageMeter = await ethers.getContractFactory("UsageMeter");
  const usageMeter = await UsageMeter.deploy(deployedContracts.DuckToken, deployedContracts.PluginRegistry);
  await usageMeter.waitForDeployment();
  deployedContracts.UsageMeter = await usageMeter.getAddress();
  console.log("✓ UsageMeter deployed to:", deployedContracts.UsageMeter);



  console.log("\n=== COMPLETE DEPLOYMENT SUMMARY ===");
  console.log("Network: DuckChain Mainnet");
  console.log("Deployer:", deployer.address);
  console.log("\nCore Contracts:");
  console.log(`DuckToken: ${deployedContracts.DuckToken}`);
  
  console.log("\nPlugin System:");
  console.log(`PluginRegistry: ${deployedContracts.PluginRegistry}`);
  console.log(`UsageMeter: ${deployedContracts.UsageMeter}`);
  

  console.log("\n=== Next Steps ===");
  console.log("1. Verify contracts on block explorer");
  console.log("2. Set up frontend with these contract addresses");
  console.log("3. Create initial skills in SkillStore");
  console.log("4. Register initial plugins in PluginRegistry");
  console.log("5. Test the complete flow");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});