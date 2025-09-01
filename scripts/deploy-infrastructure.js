// scripts/deploy-infrastructure.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function deployInfrastructure() {
    console.log('🚀 Deploying DuckGPT infrastructure...');
    
    const stage = process.env.STAGE || 'dev';
    console.log(`Stage: ${stage}`);
    
    try {
        // Deploy gateway
        console.log('\n📡 Deploying API Gateway...');
        execSync('cd gateway && npm install && npx serverless deploy', {
            stdio: 'inherit',
            env: { ...process.env, STAGE: stage }
        });
        
        // Deploy plugins
        const plugins = ['summarizer', 'meme-generator', 'nft-appraiser'];
        
        for (const plugin of plugins) {
            console.log(`\n🔌 Deploying ${plugin} plugin...`);
            execSync(`cd plugins/${plugin} && npm install && npx serverless deploy`, {
                stdio: 'inherit',
                env: { ...process.env, STAGE: stage }
            });
        }
        
        console.log('\n✅ Infrastructure deployment completed!');
        console.log('\n🔗 API Gateway URL: Check AWS Console or serverless info');
        
    } catch (error) {
        console.error('❌ Infrastructure deployment failed:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    deployInfrastructure();
}