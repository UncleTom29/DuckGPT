const { ethers } = require("hardhat");

async function main() {
  // Load deployment addresses
  const fs = require('fs');
  const network = hre.network.name;
  const deploymentFile = `deployments-${network}.json`;
  
  if (!fs.existsSync(deploymentFile)) {
    throw new Error(`Deployment file ${deploymentFile} not found`);
  }
  
  const addresses = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  
  const [deployer] = await ethers.getSigners();
  console.log("Registering plugins with account:", deployer.address);
  
  // Create verifier wallet (this will be used by your gateway oracle)
  const verifierWallet = ethers.Wallet.createRandom();
  console.log("Generated verifier wallet:", verifierWallet.address);
  console.log("Verifier private key:", verifierWallet.privateKey);
  console.log("*** SAVE THIS PRIVATE KEY FOR YOUR GATEWAY ***");
  
  // Get contract instance
  const PluginRegistry = await ethers.getContractFactory("PluginRegistry");
  const registry = PluginRegistry.attach(addresses.pluginRegistry);
  
  const DuckToken = await ethers.getContractFactory("DuckToken");
  const duckToken = DuckToken.attach(addresses.duckToken);
  
  // Approve registry to spend tokens for registration fees
  const registrationFee = await registry.registrationFee();
  const totalFees = registrationFee * 3n; // 3 plugins
  
  console.log(`Approving ${ethers.formatEther(totalFees)} DUCK for registration fees...`);
  const approveTx = await duckToken.approve(addresses.pluginRegistry, totalFees);
  await approveTx.wait();
  
  // Plugin configurations
  const plugins = [
    {
      name: "summarizer",
      description: "AI-powered text summarization using Claude",
      uri: "https://docs.duckgpt.ai/plugins/summarizer",
      pricePerCall: ethers.parseEther("0.01"), // 0.01 DUCK per call
      sla: {
        maxResponseTimeMs: 30000, // 30 seconds
        availabilityPercent: 9900, // 99%
        maxTokens: 1000
      }
    },
    {
      name: "meme-generator", 
      description: "AI meme generation with popular templates",
      uri: "https://docs.duckgpt.ai/plugins/meme-generator",
      pricePerCall: ethers.parseEther("0.02"), // 0.02 DUCK per call
      sla: {
        maxResponseTimeMs: 60000, // 60 seconds (image generation takes longer)
        availabilityPercent: 9900,
        maxTokens: 500
      }
    },
    {
      name: "nft-appraiser",
      description: "AI-powered NFT valuation and market analysis", 
      uri: "https://docs.duckgpt.ai/plugins/nft-appraiser",
      pricePerCall: ethers.parseEther("0.05"), // 0.05 DUCK per call
      sla: {
        maxResponseTimeMs: 90000, // 90 seconds (multiple API calls)
        availabilityPercent: 9500, // 95% (depends on external APIs)
        maxTokens: 2000
      }
    }
  ];
  
  const registeredPlugins = [];
  
  for (const plugin of plugins) {
    console.log(`\nRegistering ${plugin.name}...`);
    
    const tx = await registry.register(
      plugin.name,
      plugin.description, 
      plugin.uri,
      plugin.pricePerCall,
      verifierWallet.address, // Use generated verifier
      plugin.sla
    );
    
    const receipt = await tx.wait();
    
    // Find the PluginRegistered event
    const event = receipt.logs.find(log => {
      try {
        const parsed = registry.interface.parseLog(log);
        return parsed.name === 'PluginRegistered';
      } catch {
        return false;
      }
    });
    
    if (event) {
      const parsedEvent = registry.interface.parseLog(event);
      const pluginId = parsedEvent.args.pluginId;
      
      console.log(`✅ ${plugin.name} registered with ID: ${pluginId}`);
      
      registeredPlugins.push({
        id: pluginId.toString(),
        name: plugin.name,
        pricePerCall: ethers.formatEther(plugin.pricePerCall),
        txHash: tx.hash
      });
    }
  }
  
  console.log("\n=== Plugin Registration Summary ===");
  registeredPlugins.forEach(plugin => {
    console.log(`Plugin ID ${plugin.id}: ${plugin.name} - ${plugin.pricePerCall} DUCK per call`);
  });
  
  // Save plugin info and verifier key
  const pluginConfig = {
    network: network,
    verifierPrivateKey: verifierWallet.privateKey,
    verifierAddress: verifierWallet.address,
    plugins: registeredPlugins,
    contracts: addresses
  };
  
  fs.writeFileSync(
    `plugin-config-${network}.json`,
    JSON.stringify(pluginConfig, null, 2)
  );
  
  console.log(`\nConfiguration saved to plugin-config-${network}.json`);
  console.log("\n*** IMPORTANT: Save the verifier private key for your gateway configuration! ***");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });