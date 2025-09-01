// scripts/setup-environment.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function setupEnvironment() {
    console.log('🔧 Setting up DuckGPT development environment...');
    
    // Install dependencies
    console.log('\n📦 Installing dependencies...');
    
    const packages = [
        { dir: 'duckgpt-contracts', name: 'Smart Contracts' },
        { dir: 'gateway', name: 'API Gateway' },
        { dir: 'plugins/summarizer', name: 'Summarizer Plugin' },
        { dir: 'plugins/meme-generator', name: 'Meme Generator Plugin' },
        { dir: 'plugins/nft-appraiser', name: 'NFT Appraiser Plugin' },
        { dir: 'sdk/javascript', name: 'JavaScript SDK' },
        { dir: 'demo/telegram-bot', name: 'Telegram Bot' }
    ];
    
    for (const pkg of packages) {
        if (fs.existsSync(pkg.dir)) {
            console.log(`Installing ${pkg.name}...`);
            try {
                execSync(`cd ${pkg.dir} && npm install`, { stdio: 'inherit' });
                console.log(`✅ ${pkg.name} dependencies installed`);
            } catch (error) {
                console.error(`❌ Failed to install ${pkg.name} dependencies:`, error.message);
            }
        }
    }
    
    // Setup Python SDK
    if (fs.existsSync('sdk/python')) {
        console.log('\n🐍 Setting up Python SDK...');
        try {
            execSync('cd sdk/python && pip install -e .', { stdio: 'inherit' });
            console.log('✅ Python SDK installed');
        } catch (error) {
            console.warn('⚠️ Python SDK setup failed. Install manually if needed.');
        }
    }
    
    // Create environment files
    console.log('\n📄 Creating environment configuration files...');
    
    const envFiles = [
        {
            path: '.env.example',
            content: `
# DuckGPT Configuration Template

# Blockchain Network
RPC_URL=https://rpc.duckchain.io/
CHAIN_ID=5545
PRIVATE_KEY=your_private_key_here

# Contract Addresses (set after deployment)
DUCK_TOKEN_ADDRESS=0x...
PLUGIN_REGISTRY_ADDRESS=0x...
USAGE_METER_ADDRESS=0x...
ORACLE_BRIDGE_ADDRESS=0x...

# AWS Configuration
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_REGION=us-east-1

# API Configuration
DUCKGPT_API_URL=https://your-api-gateway-url
VERIFIER_PRIVATE_KEY=your_verifier_private_key

# External APIs
OPENSEA_API_KEY=your_opensea_api_key

# Telegram Bot (optional)
TELEGRAM_BOT_TOKEN=your_bot_token
BOT_PRIVATE_KEY=your_bot_wallet_private_key
            `.trim()
        }
    ];
    
    envFiles.forEach(file => {
        if (!fs.existsSync(file.path)) {
            fs.writeFileSync(file.path, file.content);
            console.log(`✅ Created ${file.path}`);
        } else {
            console.log(`⚠️ ${file.path} already exists, skipping...`);
        }
    });
    
    // Setup Git hooks
    console.log('\n🔨 Setting up Git hooks...');
    const hooksDir = '.git/hooks';
    if (fs.existsSync('.git')) {
        const preCommitHook = `#!/bin/bash
# DuckGPT pre-commit hook
echo "🔍 Running pre-commit checks..."

# Check for environment variables in commits
if git diff --cached --name-only | xargs grep -l "PRIVATE_KEY\\|SECRET\\|TOKEN" 2>/dev/null; then
    echo "❌ Private keys or secrets found in staged files!"
    echo "Please remove sensitive data before committing."
    exit 1
fi

# Run linting
echo "🧹 Running linter..."
npm run lint --if-present

echo "✅ Pre-commit checks passed!"
`;
        
        if (fs.existsSync(hooksDir)) {
            fs.writeFileSync(path.join(hooksDir, 'pre-commit'), preCommitHook);
            execSync(`chmod +x ${hooksDir}/pre-commit`);
            console.log('✅ Git pre-commit hook installed');
        }
    }
    
    console.log('\n🎉 Environment setup completed!');
    console.log('\n📋 Next steps:');
    console.log('1. Copy .env.example to .env and fill in your configuration');
    console.log('2. Deploy contracts: npm run deploy:contracts');
    console.log('3. Deploy infrastructure: npm run deploy:infrastructure'); 
    console.log('4. Test the system: npm run test');
    console.log('\n📚 Check docs/ for detailed documentation');
}

if (require.main === module) {
    setupEnvironment();
}
