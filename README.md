# DuckGPT
A decentralized marketplace of AI Skills (plugins) callable by agents/dApps. Each plugin is a serverless function with an on-chain payment + metering wrapper.

# DuckGPT - On-Chain AI Plugin Hub

## Project Structure

```
duckgpt/
├── contracts/                    # Smart contracts (Solidity)
│   ├── src/
│   │   ├── PluginRegistry.sol
│   │   ├── UsageMeter.sol
│   │   ├── OracleBridge.sol
│   │   └── DuckToken.sol
│   ├── test/
│   ├── deploy/
│   └── hardhat.config.js
│
├── gateway/                      # AWS Gateway & Core Infrastructure
│   ├── src/
│   │   ├── gateway.js           # Main API Gateway Lambda
│   │   ├── auth.js              # Authentication & validation
│   │   ├── oracle.js            # Receipt signing & verification
│   │   └── utils.js             # Utilities
│   ├── infrastructure/
│   │   ├── serverless.yml       # Serverless Framework config
│   │   └── aws-resources.yml    # CloudFormation templates
│   └── package.json
│
├── plugins/                      # Plugin implementations
│   ├── summarizer/
│   │   ├── src/handler.js
│   │   ├── serverless.yml
│   │   └── package.json
│   ├── meme-generator/
│   │   ├── src/handler.js
│   │   ├── serverless.yml
│   │   └── package.json
│   └── nft-appraiser/
│       ├── src/handler.js
│       ├── serverless.yml
│       └── package.json
│
├── sdk/                          # Client SDKs
│   ├── javascript/
│   │   ├── src/
│   │   │   ├── index.js
│   │   │   ├── client.js
│   │   │   └── utils.js
│   │   └── package.json
│   └── python/
│       ├── duckgpt/
│       │   ├── __init__.py
│       │   ├── client.py
│       │   └── utils.py
│       └── setup.py
│
├── demo/                         # Demo applications
│   ├── telegram-bot/
│   │   ├── src/bot.js
│   │   ├── package.json
│   │   └── Dockerfile
│   └── web-interface/
│       ├── src/
│       ├── public/
│       └── package.json
│
├── docs/                         # Documentation
│   ├── API.md
│   ├── DEPLOYMENT.md
│   ├── DEVELOPMENT.md
│   └── ARCHITECTURE.md
│
└── scripts/                      # Deployment & utility scripts
    ├── deploy-contracts.js
    ├── deploy-infrastructure.js
    └── setup-environment.js
```

## Development Milestones

### Milestone 1: Smart Contracts Foundation
- [ ] Deploy DuckToken contract
- [ ] Implement PluginRegistry contract
- [ ] Implement UsageMeter contract  
- [ ] Implement OracleBridge contract
- [ ] Write comprehensive tests
- [ ] Deploy to testnet

### Milestone 2: Gateway Infrastructure
- [ ] Setup AWS infrastructure (API Gateway, Lambda, DynamoDB)
- [ ] Implement authentication and request validation
- [ ] Implement oracle receipt signing
- [ ] Setup monitoring and logging

### Milestone 3: Plugin Development
- [ ] Create plugin runtime framework
- [ ] Implement Summarizer plugin (Bedrock)
- [ ] Implement Meme Generator plugin
- [ ] Implement NFT Appraiser plugin
- [ ] Plugin testing and validation

### Milestone 4: SDK Development
- [ ] JavaScript/TypeScript SDK
- [ ] Python SDK
- [ ] Documentation and examples
- [ ] NPM/PyPI publishing

### Milestone 5: Demo Applications
- [ ] Telegram bot implementation
- [ ] Web interface for testing
- [ ] Integration testing
- [ ] Performance optimization

### Milestone 6: Production Deployment
- [ ] Mainnet deployment
- [ ] Security audit
- [ ] Performance monitoring
- [ ] User documentation

## Quick Start

```bash
# Clone repository
git clone https://github.com/uncletom29/duckgpt.git
cd duckgpt

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your configuration

# Deploy contracts (testnet)
cd contracts
npm run deploy:testnet

# Deploy gateway infrastructure
cd ../gateway
npm run deploy:dev

# Deploy plugins
cd ../plugins
npm run deploy:all

# Run tests
npm run test:all
```

## Environment Variables

```bash
# Blockchain
PRIVATE_KEY=your_private_key
RPC_URL=https://testnet-rpc.duckchain.io
PLUGIN_REGISTRY_ADDRESS=0x...
USAGE_METER_ADDRESS=0x...

# AWS
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1

# API
API_GATEWAY_URL=https://your-api-id.execute-api.region.amazonaws.com
VERIFIER_PRIVATE_KEY=your_oracle_private_key

# External APIs
OPENAI_API_KEY=sk-...
BEDROCK_ACCESS_KEY=your_bedrock_key
```

## Architecture Overview

DuckGPT implements a three-layer architecture:

1. **On-Chain Layer**: Smart contracts managing plugin registry, payments, and verification
2. **Gateway Layer**: AWS infrastructure handling authentication, routing, and oracle functions
3. **Plugin Layer**: Serverless functions implementing AI capabilities

The system uses a pay-per-call model with $DUCK tokens, ensuring fair compensation for plugin developers while maintaining decentralized governance of the marketplace.