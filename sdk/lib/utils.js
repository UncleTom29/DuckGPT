// sdk/javascript/src/client.js
const axios = require('axios');
const { ethers } = require('ethers');
const { createAuthHeaders, validatePayload } = require('./utils');

class DuckGPTClient {
    constructor(options = {}) {
        this.apiUrl = options.apiUrl || process.env.DUCKGPT_API_URL;
        this.privateKey = options.privateKey || process.env.PRIVATE_KEY;
        this.rpcUrl = options.rpcUrl || process.env.RPC_URL;
        this.timeout = options.timeout || 30000;
        
        if (!this.apiUrl) {
            throw new Error('API URL is required');
        }
        
        if (!this.privateKey) {
            throw new Error('Private key is required');
        }
        
        this.wallet = new ethers.Wallet(this.privateKey);
        this.provider = new ethers.JsonRpcProvider(this.rpcUrl);
        this.walletWithProvider = this.wallet.connect(this.provider);
        
        // Contract instances
        this.contracts = {
            pluginRegistry: null,
            usageMeter: null,
            duckToken: null
        };
        
        this.initializeContracts();
    }
    
    async initializeContracts() {
        const pluginRegistryABI = [
            "function plugins(uint256) view returns (tuple(string name, string description, string uri, address owner, uint256 pricePerCall, uint256 version, address verifierPubKey, bool active, uint256 totalCalls, uint256 totalEarnings, uint256 createdAt, uint256 updatedAt))",
            "function getActivePlugins() view returns (uint256[])"
        ];
        
        const usageMeterABI = [
            "function prepay(uint256 pluginId, uint256 amount) external",
            "function getUserEscrow(address user, uint256 pluginId) view returns (uint256)"
        ];
        
        const duckTokenABI = [
            "function approve(address spender, uint256 amount) external returns (bool)",
            "function balanceOf(address account) view returns (uint256)",
            "function allowance(address owner, address spender) view returns (uint256)"
        ];
        
        this.contracts.pluginRegistry = new ethers.Contract(
            process.env.PLUGIN_REGISTRY_ADDRESS,
            pluginRegistryABI,
            this.walletWithProvider
        );
        
        this.contracts.usageMeter = new ethers.Contract(
            process.env.USAGE_METER_ADDRESS,
            usageMeterABI,
            this.walletWithProvider
        );
        
        this.contracts.duckToken = new ethers.Contract(
            process.env.DUCK_TOKEN_ADDRESS,
            duckTokenABI,
            this.walletWithProvider
        );
    }
    
    // Main plugin call method
    async callPlugin(pluginId, payload, options = {}) {
        try {
            // Validate inputs
            const validation = validatePayload(payload, pluginId);
            if (!validation.valid) {
                throw new Error(`Validation failed: ${validation.error}`);
            }
            
            // Get plugin info
            const plugin = await this.contracts.pluginRegistry.plugins(pluginId);
            if (!plugin.active) {
                throw new Error('Plugin not found or inactive');
            }
            
            // Check/ensure sufficient escrow
            await this.ensureSufficientEscrow(pluginId, plugin.pricePerCall, options.autoTopup);
            
            // Create request
            const request = {
                payload: payload,
                metadata: {
                    pluginId: pluginId,
                    timestamp: Date.now(),
                    version: '1.0.0'
                }
            };
            
            // Create authentication headers
            const authHeaders = await createAuthHeaders(
                this.wallet,
                this.wallet.address,
                request
            );
            
            // Make API call
            const response = await axios.post(
                `${this.apiUrl}/api/v1/plugins/${pluginId}/call`,
                request,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        ...authHeaders
                    },
                    timeout: this.timeout
                }
            );
            
            if (!response.data.success) {
                throw new Error(response.data.error || 'Plugin call failed');
            }
            
            return {
                success: true,
                result: response.data.result,
                receipt: response.data.receipt,
                metadata: response.data.metadata,
                cost: plugin.pricePerCall
            };
            
        } catch (error) {
            console.error('Plugin call failed:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    // Convenience methods for specific plugins
    async summarize(text, options = {}) {
        return this.callPlugin(1, {
            text: text,
            maxLength: options.maxLength || 150,
            style: options.style || 'concise'
        });
    }
    
    async generateMeme(prompt, options = {}) {
        return this.callPlugin(2, {
            prompt: prompt,
            template: options.template || 'drake',
            style: options.style || 'funny'
        });
    }
    
    async appriseNFT(contractAddress, tokenId, options = {}) {
        return this.callPlugin(3, {
            contractAddress: contractAddress,
            tokenId: tokenId,
            chain: options.chain || 'ethereum'
        });
    }
    
    // Escrow management
    async prepayPlugin(pluginId, amount) {
        try {
            // First approve DUCK tokens
            const approveTx = await this.contracts.duckToken.approve(
                process.env.USAGE_METER_ADDRESS,
                amount
            );
            await approveTx.wait();
            
            // Then prepay
            const prepayTx = await this.contracts.usageMeter.prepay(pluginId, amount);
            await prepayTx.wait();
            
            return {
                success: true,
                transactionHash: prepayTx.hash,
                amount: ethers.formatEther(amount)
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    async getEscrowBalance(pluginId) {
        try {
            const balance = await this.contracts.usageMeter.getUserEscrow(
                this.wallet.address,
                pluginId
            );
            
            return ethers.formatEther(balance);
        } catch (error) {
            throw new Error(`Failed to get escrow balance: ${error.message}`);
        }
    }
    
    async ensureSufficientEscrow(pluginId, requiredAmount, autoTopup = false) {
        const currentEscrow = await this.contracts.usageMeter.getUserEscrow(
            this.wallet.address,
            pluginId
        );
        
        if (currentEscrow < requiredAmount) {
            if (!autoTopup) {
                throw new Error(`Insufficient escrow. Required: ${ethers.formatEther(requiredAmount)} DUCK, Current: ${ethers.formatEther(currentEscrow)} DUCK`);
            }
            
            // Auto-topup with 10x required amount
            const topupAmount = requiredAmount * 10n;
            const result = await this.prepayPlugin(pluginId, topupAmount);
            
            if (!result.success) {
                throw new Error(`Auto-topup failed: ${result.error}`);
            }
        }
    }
    
    // Plugin discovery
    async listPlugins() {
        try {
            const activeIds = await this.contracts.pluginRegistry.getActivePlugins();
            const plugins = [];
            
            for (const id of activeIds) {
                const plugin = await this.contracts.pluginRegistry.plugins(id);
                plugins.push({
                    id: id.toString(),
                    name: plugin.name,
                    description: plugin.description,
                    pricePerCall: ethers.formatEther(plugin.pricePerCall),
                    version: plugin.version.toString(),
                    owner: plugin.owner,
                    totalCalls: plugin.totalCalls.toString(),
                    active: plugin.active
                });
            }
            
            return plugins;
        } catch (error) {
            throw new Error(`Failed to list plugins: ${error.message}`);
        }
    }
    
    async getPlugin(pluginId) {
        try {
            const plugin = await this.contracts.pluginRegistry.plugins(pluginId);
            
            return {
                id: pluginId.toString(),
                name: plugin.name,
                description: plugin.description,
                uri: plugin.uri,
                owner: plugin.owner,
                pricePerCall: ethers.formatEther(plugin.pricePerCall),
                version: plugin.version.toString(),
                active: plugin.active,
                totalCalls: plugin.totalCalls.toString(),
                totalEarnings: ethers.formatEther(plugin.totalEarnings),
                createdAt: new Date(plugin.createdAt.toNumber() * 1000),
                updatedAt: new Date(plugin.updatedAt.toNumber() * 1000)
            };
        } catch (error) {
            throw new Error(`Failed to get plugin: ${error.message}`);
        }
    }
    
    // Token management
    async getDuckBalance() {
        try {
            const balance = await this.contracts.duckToken.balanceOf(this.wallet.address);
            return ethers.formatEther(balance);
        } catch (error) {
            throw new Error(`Failed to get DUCK balance: ${error.message}`);
        }
    }
    
    async approveDuck(amount) {
        try {
            const tx = await this.contracts.duckToken.approve(
                process.env.USAGE_METER_ADDRESS,
                ethers.parseEther(amount)
            );
            await tx.wait();
            
            return {
                success: true,
                transactionHash: tx.hash
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = DuckGPTClient;
