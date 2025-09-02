// demo/telegram-bot/src/bot.js
const TelegramBot = require('node-telegram-bot-api');
const { DuckGPTClient } = require('duckgpt-sdk');
const { ethers } = require('ethers');
require('dotenv').config();

class DuckGPTTelegramBot {
    constructor() {
        this.botToken = process.env.TELEGRAM_BOT_TOKEN;
        this.bot = new TelegramBot(this.botToken, { polling: true });
        
        // Initialize DuckGPT client
        this.duckgpt = new DuckGPTClient({
            apiUrl: process.env.DUCKGPT_API_URL,
            privateKey: process.env.BOT_PRIVATE_KEY,
            rpcUrl: process.env.RPC_URL
        });
        
        // User session management (in production, use Redis)
        this.userSessions = new Map();
        
        this.setupCommands();
        this.setupHandlers();
        
        console.log('🦆 DuckGPT Telegram Bot started!');
    }
    
    setupCommands() {
        // Set bot commands
        this.bot.setMyCommands([
            { command: 'start', description: 'Start using DuckGPT' },
            { command: 'help', description: 'Show help message' },
            { command: 'balance', description: 'Check your DUCK balance and escrow' },
            { command: 'plugins', description: 'List available plugins' },
            { command: 'summarize', description: 'Summarize text' },
            { command: 'meme', description: 'Generate a meme' },
            { command: 'nft', description: 'Appraise an NFT' },
            { command: 'topup', description: 'Add funds to plugin escrow' },
            { command: 'wallet', description: 'Connect your wallet' }
        ]);
    }
    
    setupHandlers() {
        // Start command
        this.bot.onText(/\/start/, async (msg) => {
            const chatId = msg.chat.id;
            const welcomeMessage = `
🦆 *Welcome to DuckGPT!*

I'm your gateway to decentralized AI plugins powered by $DUCK tokens.

*Available Plugins:*
🔹 Summarizer - Intelligent text summarization
🔹 Meme Generator - AI-powered meme creation  
🔹 NFT Appraiser - Smart NFT valuation

*Getting Started:*
1. Connect your wallet: /wallet
2. Check available plugins: /plugins
3. Top up your escrow: /topup
4. Start using plugins!

Use /help for detailed commands.
            `;
            
            this.bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
        });
        
        // Help command
        this.bot.onText(/\/help/, async (msg) => {
            const chatId = msg.chat.id;
            const helpMessage = `
🆘 *DuckGPT Commands*

*Wallet Management:*
/wallet - Connect your wallet
/balance - Check DUCK balance and escrow
/topup [plugin] [amount] - Add escrow funds

*Plugin Usage:*
/plugins - List all available plugins
/summarize [text] - Summarize text (0.001 DUCK)
/meme [prompt] - Generate meme (0.005 DUCK)  
/nft [contract] [tokenId] - Appraise NFT (0.01 DUCK)

*Examples:*
\`/summarize The quick brown fox jumps over the lazy dog...\`
\`/meme crypto going to the moon\`
\`/nft 0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D 1\`

*Pro Tips:*
• Keep some DUCK in escrow for instant plugin calls
• Use batch operations for multiple requests
• Check your balance before making expensive calls
            `;
            
            this.bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
        });
        
        // Wallet connection
        this.bot.onText(/\/wallet/, async (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            
            const session = this.getUserSession(userId);
            
            if (session.walletConnected) {
                const message = `
✅ *Wallet Connected*

Address: \`${session.userAddress}\`
DUCK Balance: ${await this.getDuckBalance(session.userAddress)} DUCK

Use /balance to check plugin escrow balances.
                `;
                
                this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
            } else {
                const message = `
🔗 *Connect Your Wallet*

To use DuckGPT plugins, you need to connect your wallet.

Please send me your wallet address in this format:
\`wallet:YOUR_ADDRESS\`

Example: \`wallet:0x1234567890123456789012345678901234567890\`

⚠️ *Security Note:* This bot only needs your public address, never send your private key!
                `;
                
                this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
            }
        });
        
        // Handle wallet address input
        this.bot.onText(/^wallet:0x[a-fA-F0-9]{40}$/, async (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            const address = msg.text.substring(7); // Remove 'wallet:' prefix
            
            if (ethers.isAddress(address)) {
                this.setUserSession(userId, {
                    walletConnected: true,
                    userAddress: ethers.getAddress(address) // Checksum format
                });
                
                const balance = await this.getDuckBalance(address);
                
                const message = `
✅ *Wallet Connected Successfully!*

Address: \`${address}\`
DUCK Balance: ${balance} DUCK

You can now use DuckGPT plugins! Try:
• /summarize [text] - Summarize content
• /meme [prompt] - Generate memes
• /nft [contract] [tokenId] - Appraise NFTs

Use /topup to add escrow funds for instant plugin calls.
                `;
                
                this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
            } else {
                this.bot.sendMessage(chatId, '❌ Invalid wallet address format. Please try again.');
            }
        });
        
        // Balance command
        this.bot.onText(/\/balance/, async (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            
            const session = this.getUserSession(userId);
            
            if (!session.walletConnected) {
                this.bot.sendMessage(chatId, '⚠️ Please connect your wallet first using /wallet');
                return;
            }
            
            try {
                const duckBalance = await this.getDuckBalance(session.userAddress);
                const escrowBalances = await this.getEscrowBalances(session.userAddress);
                
                let message = `
💰 *Your DuckGPT Balances*

DUCK Wallet Balance: ${duckBalance} DUCK

*Plugin Escrow Balances:*
🔹 Summarizer: ${escrowBalances.summarizer} DUCK
🔹 Meme Generator: ${escrowBalances.memeGenerator} DUCK  
🔹 NFT Appraiser: ${escrowBalances.nftAppraiser} DUCK

Use /topup [plugin] [amount] to add escrow funds.
                `;
                
                this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
                
            } catch (error) {
                console.error('Balance check error:', error);
                this.bot.sendMessage(chatId, '❌ Failed to check balance. Please try again later.');
            }
        });
        
        // Plugins list command
        this.bot.onText(/\/plugins/, async (msg) => {
            const chatId = msg.chat.id;
            
            try {
                const plugins = await this.duckgpt.listPlugins();
                
                let message = `
🔌 *Available DuckGPT Plugins*

`;
                
                plugins.forEach((plugin, index) => {
                    const emoji = ['🔹', '🔸', '🔶'][index] || '🔹';
                    message += `${emoji} *${plugin.name}*
   ${plugin.description}
   Price: ${plugin.pricePerCall} DUCK per call
   Calls: ${plugin.totalCalls}

`;
                });
                
                message += `
*Usage Examples:*
• \`/summarize The blockchain revolution is transforming...\`
• \`/meme when you finally understand smart contracts\`
• \`/nft 0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D 1\`
                `;
                
                this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
                
            } catch (error) {
                console.error('Plugins list error:', error);
                this.bot.sendMessage(chatId, '❌ Failed to load plugins. Please try again later.');
            }
        });
        
        // Summarize command
        this.bot.onText(/\/summarize (.+)/, async (msg, match) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            const text = match[1];
            
            const session = this.getUserSession(userId);
            if (!session.walletConnected) {
                this.bot.sendMessage(chatId, '⚠️ Please connect your wallet first using /wallet');
                return;
            }
            
            if (text.length < 50) {
                this.bot.sendMessage(chatId, '⚠️ Text too short for summarization. Please provide at least 50 characters.');
                return;
            }
            
            this.bot.sendMessage(chatId, '🤔 Analyzing and summarizing your text...');
            
            try {
                const result = await this.duckgpt.summarize(text, {
                    maxLength: 100,
                    style: 'concise'
                });
                
                if (result.success) {
                    const summary = result.result.summary;
                    const metrics = result.result.metrics;
                    
                    const message = `
📝 *Text Summary*

${summary}

*Metrics:*
• Original: ${metrics.originalLength} characters
• Summary: ${metrics.summaryLength} characters  
• Compression: ${metrics.compressionRatio}x
• Reading time: ~${metrics.estimatedReadingTime} min

💰 Cost: 0.001 DUCK
                    `;
                    
                    this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
                } else {
                    this.bot.sendMessage(chatId, `❌ Summarization failed: ${result.error}`);
                }
                
            } catch (error) {
                console.error('Summarize error:', error);
                this.bot.sendMessage(chatId, '❌ Failed to summarize text. Please check your escrow balance.');
            }
        });
        
        // Meme generation command
        this.bot.onText(/\/meme (.+)/, async (msg, match) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            const prompt = match[1];
            
            const session = this.getUserSession(userId);
            if (!session.walletConnected) {
                this.bot.sendMessage(chatId, '⚠️ Please connect your wallet first using /wallet');
                return;
            }
            
            this.bot.sendMessage(chatId, '🎨 Generating your meme...');
            
            try {
                const result = await this.duckgpt.generateMeme(prompt, {
                    template: 'drake',
                    style: 'funny'
                });
                
                if (result.success) {
                    const imageUrl = result.result.imageUrl;
                    const texts = result.result.texts;
                    
                    await this.bot.sendPhoto(chatId, imageUrl, {
                        caption: `🎭 *Meme Generated!*\n\nTexts: ${texts.join(' / ')}\n💰 Cost: 0.005 DUCK`,
                        parse_mode: 'Markdown'
                    });
                } else {
                    this.bot.sendMessage(chatId, `❌ Meme generation failed: ${result.error}`);
                }
                
            } catch (error) {
                console.error('Meme generation error:', error);
                this.bot.sendMessage(chatId, '❌ Failed to generate meme. Please check your escrow balance.');
            }
        });
        
        // NFT appraisal command  
        this.bot.onText(/\/nft ([0-9a-fA-Fx]{42}) (\d+)/, async (msg, match) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            const contractAddress = match[1];
            const tokenId = parseInt(match[2]);
            
            const session = this.getUserSession(userId);
            if (!session.walletConnected) {
                this.bot.sendMessage(chatId, '⚠️ Please connect your wallet first using /wallet');
                return;
            }
            
            if (!ethers.isAddress(contractAddress)) {
                this.bot.sendMessage(chatId, '❌ Invalid contract address format.');
                return;
            }
            
            this.bot.sendMessage(chatId, '🔍 Analyzing NFT and gathering market data...');
            
            try {
                const result = await this.duckgpt.appriseNFT(contractAddress, tokenId);
                
                if (result.success) {
                    const appraisal = result.result.appraisal;
                    const nftData = result.result.nftData;
                    
                    let message = `
🖼️ *NFT Appraisal Report*

*${nftData.name || `Token #${tokenId}`}*
Collection: ${nftData.collection?.name || 'Unknown'}

*Estimated Value:*
${appraisal.estimatedValueMin} - ${appraisal.estimatedValueMax} ETH

*Market Sentiment:* ${appraisal.marketSentiment}
*Recommendation:* ${appraisal.recommendation}
*Confidence:* ${appraisal.confidence}/10

*Key Factors:*
${appraisal.keyFactors.map(factor => `• ${factor}`).join('\n')}

💰 Cost: 0.01 DUCK
                    `;
                    
                    this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
                } else {
                    this.bot.sendMessage(chatId, `❌ NFT appraisal failed: ${result.error}`);
                }
                
            } catch (error) {
                console.error('NFT appraisal error:', error);
                this.bot.sendMessage(chatId, '❌ Failed to appraise NFT. Please check your escrow balance.');
            }
        });
        
        // Top up escrow command
        this.bot.onText(/\/topup (\w+) ([\d.]+)/, async (msg, match) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            const pluginName = match[1].toLowerCase();
            const amount = parseFloat(match[2]);
            
            const session = this.getUserSession(userId);
            if (!session.walletConnected) {
                this.bot.sendMessage(chatId, '⚠️ Please connect your wallet first using /wallet');
                return;
            }
            
            // Map plugin names to IDs
            const pluginMap = {
                'summarizer': 1,
                'meme': 2,
                'meme-generator': 2,
                'nft': 3,
                'nft-appraiser': 3
            };
            
            const pluginId = pluginMap[pluginName];
            if (!pluginId) {
                this.bot.sendMessage(chatId, '❌ Invalid plugin name. Use: summarizer, meme, or nft');
                return;
            }
            
            if (amount <= 0 || amount > 100) {
                this.bot.sendMessage(chatId, '❌ Amount must be between 0 and 100 DUCK');
                return;
            }
            
            this.bot.sendMessage(chatId, `💸 Processing top-up of ${amount} DUCK...`);
            
            try {
                // Note: In a real bot, this would need the user's private key
                // For demo purposes, we'll show what would happen
                const message = `
⚠️ *Top-up Instructions*

To top up your escrow:

1. Visit: https://duckgpt.app/topup
2. Connect wallet: ${session.userAddress}
3. Select plugin: ${pluginName}  
4. Amount: ${amount} DUCK

Or use the DuckGPT SDK directly:
\`\`\`javascript
await duckgpt.prepayPlugin(${pluginId}, "${amount}");
\`\`\`

💡 This will enable instant plugin calls without waiting for transactions!
                `;
                
                this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
                
            } catch (error) {
                console.error('Top-up error:', error);
                this.bot.sendMessage(chatId, '❌ Top-up failed. Please try again or use the web interface.');
            }
        });
        
        // Handle unknown commands
        this.bot.on('message', (msg) => {
            if (msg.text?.startsWith('/') && !msg.text.match(/\/(start|help|wallet|balance|plugins|summarize|meme|nft|topup)/)) {
                const chatId = msg.chat.id;
                this.bot.sendMessage(chatId, '❓ Unknown command. Use /help to see available commands.');
            }
        });
        
        // Error handling
        this.bot.on('error', (error) => {
            console.error('Telegram bot error:', error);
        });
        
        this.bot.on('polling_error', (error) => {
            console.error('Polling error:', error);
        });
    }
    
    // Helper methods
    getUserSession(userId) {
        if (!this.userSessions.has(userId)) {
            this.userSessions.set(userId, {
                walletConnected: false,
                userAddress: null,
                lastActivity: Date.now()
            });
        }
        
        const session = this.userSessions.get(userId);
        session.lastActivity = Date.now();
        return session;
    }
    
    setUserSession(userId, updates) {
        const session = this.getUserSession(userId);
        Object.assign(session, updates);
        this.userSessions.set(userId, session);
    }
    
    async getDuckBalance(address) {
        try {
            // In a real implementation, this would query the blockchain
            return '10.5'; // Mock balance
        } catch (error) {
            console.error('Balance check error:', error);
            return '0';
        }
    }
    
    async getEscrowBalances(address) {
        try {
            // In a real implementation, this would query the usage meter contract
            return {
                summarizer: '0.050',
                memeGenerator: '0.025', 
                nftAppraiser: '0.100'
            };
        } catch (error) {
            console.error('Escrow balance error:', error);
            return {
                summarizer: '0',
                memeGenerator: '0',
                nftAppraiser: '0'
            };
        }
    }
    
    // Clean up old sessions periodically
    cleanupSessions() {
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        
        for (const [userId, session] of this.userSessions.entries()) {
            if (now - session.lastActivity > maxAge) {
                this.userSessions.delete(userId);
            }
        }
    }
}

// Initialize and start the bot
if (require.main === module) {
    // Validate environment variables
    const requiredEnvVars = [
        'TELEGRAM_BOT_TOKEN',
        'DUCKGPT_API_URL',
        'BOT_PRIVATE_KEY',
        'RPC_URL'
    ];
    
    const missing = requiredEnvVars.filter(env => !process.env[env]);
    if (missing.length > 0) {
        console.error('Missing required environment variables:', missing);
        process.exit(1);
    }
    
    const bot = new DuckGPTTelegramBot();
    
    // Clean up sessions every hour
    setInterval(() => {
        bot.cleanupSessions();
    }, 60 * 60 * 1000);
    
    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('Shutting down DuckGPT Telegram Bot...');
        bot.bot.stopPolling();
        process.exit(0);
    });
}

module.exports = DuckGPTTelegramBot;
