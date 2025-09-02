# DuckGPT - On-Chain AI Plugin Hub

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Quick Start](#quick-start)
4. [Development Guide](#development-guide)
5. [API Documentation](#api-documentation)
6. [SDK Usage](#sdk-usage)
7. [Plugin Development](#plugin-development)
8. [Deployment Guide](#deployment-guide)
9. [Security Considerations](#security-considerations)
10. [Troubleshooting](#troubleshooting)

## Overview

DuckGPT is a decentralized marketplace for AI capabilities, where each AI "skill" is a serverless plugin with on-chain payment and metering. Developers can monetize their AI services, while users pay per use with $DUCK tokens.

### Key Features

- **Decentralized AI Marketplace**: Browse and use AI plugins from various developers
- **Pay-per-Use Model**: Only pay for what you use with $DUCK tokens
- **Serverless Architecture**: Scalable AWS Lambda-based plugin execution
- **On-Chain Verification**: Cryptographic receipts for all plugin calls
- **Developer Revenue Sharing**: Plugin creators earn from usage
- **Easy Integration**: Simple SDKs for JavaScript, Python, and more

### Use Cases

- **Content Creation**: Text summarization, meme generation, article writing
- **Analysis & Insights**: NFT appraisal, market analysis, data processing
- **Automation**: Workflow automation, batch processing, scheduled tasks
- **Integration**: Add AI capabilities to existing applications and bots

## Architecture

### High-Level Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client Apps   │    │   Telegram Bot  │    │   Web Interface │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────┴──────────────┐
                    │      DuckGPT SDK          │
                    └─────────────┬──────────────┘
                                 │
                    ┌─────────────┴──────────────┐
                    │     API Gateway           │
                    │  (Authentication &        │
                    │   Request Routing)        │
                    └─────────────┬──────────────┘
                                 │
           ┌─────────────────────┼─────────────────────┐
           │                     │                     │
    ┌──────┴──────┐    ┌─────────┴──────┐    ┌─────────┴──────┐
    │ Summarizer  │    │ Meme Generator │    │ NFT Appraiser  │
    │   Plugin    │    │     Plugin     │    │     Plugin     │
    └─────────────┘    └────────────────┘    └────────────────┘
                                 │
                    ┌─────────────┴──────────────┐
                    │   Smart Contracts         │
                    │ (Payment & Verification)   │
                    └────────────────────────────┘
```

### Technology Stack

- **Smart Contracts**: Solidity, Hardhat, OpenZeppelin
- **Backend**: Node.js, AWS Lambda, API Gateway
- **AI Services**: AWS Bedrock (Claude), SageMaker
- **Storage**: DynamoDB, S3
- **Monitoring**: CloudWatch, EventBridge
- **Client SDKs**: JavaScript, Python
- **Demo**: Telegram Bot API

### Contract Architecture

1. **PluginRegistry**: Manages plugin metadata, ownership, and pricing
2. **UsageMeter**: Handles payments, escrow, and usage tracking  
3. **OracleBridge**: Verifies off-chain execution with signed receipts
4. **DuckToken**: ERC20 token for payments and governance

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Python 3.8+ (for Python SDK)
- AWS Account with CLI configured
- Ethereum wallet with some testnet ETH
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/uncletom29/duckgpt.git
cd duckgpt

# Setup environment
npm run setup

# Copy and configure environment
cp .env.example .env
# Edit .env with your configuration
```

### Deploy to Local Testnet

```bash
# Start local blockchain
npx hardhat node

# Deploy contracts
npm run deploy:contracts

# Deploy infrastructure (requires AWS)
npm run deploy:infrastructure

# Run tests
npm test
```

### First Plugin Call

```javascript
const { DuckGPTClient } = require('duckgpt-sdk');

const client = new DuckGPTClient({
    apiUrl: 'https://your-api-gateway-url',
    privateKey: 'your-private-key',
    rpcUrl: 'http://localhost:8545'
});

// Prepay for plugin usage
await client.prepayPlugin(1, 0.01); // Plugin 1, 0.01 DUCK

// Summarize text
const result = await client.summarize(
    'The quick brown fox jumps over the lazy dog. This is a sample text for testing the summarization plugin.'
);

console.log(result.result.summary);
```

## Development Guide

### Project Structure

```
duckgpt/
├── contracts/          # Smart contracts
├── gateway/           # API Gateway Lambda
├── plugins/           # Plugin implementations
├── sdk/              # Client SDKs
├── bot/             # Telegram Bot Usage Demo
├── docs/             # Documentation
├── scripts/          # Deployment scripts
└── tests/            # Integration tests
```

### Local Development

1. **Smart Contracts**
```bash
cd contracts
npm install
npx hardhat compile
npx hardhat test
npx hardhat node  # Run local blockchain
```

2. **API Gateway**
```bash
cd gateway
npm install
npm run offline  # Run locally with serverless-offline
```

3. **Plugins**
```bash
cd plugins/summarizer
npm install
npm run offline
```

4. **SDKs**
```bash
# JavaScript SDK
cd sdk/javascript
npm install
npm test
npm run build

# Python SDK
cd sdk/python  
pip install -e .
python -m pytest
```

### Adding New Plugins

1. Create plugin directory in `plugins/`
2. Implement handler with standard interface
3. Add serverless.yml configuration
4. Update PluginRegistry contract
5. Add SDK methods
6. Write tests and documentation

Example plugin structure:
```
plugins/my-plugin/
├── src/
│   └── handler.js
├── test/
│   └── handler.test.js
├── serverless.yml
└── package.json
```

### Testing Strategy

- **Unit Tests**: Test individual functions and components
- **Integration Tests**: Test cross-component interactions
- **Contract Tests**: Comprehensive smart contract testing
- **End-to-End Tests**: Full user journey testing

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:contracts
npm run test:sdk
npm run test:integration
```

## API Documentation

### Authentication

All API requests require signature-based authentication:

```javascript
// Headers required for all requests
{
    'X-User-Address': '0x...',        // Wallet address
    'X-Signature': '0x...',           // Message signature
    'X-Timestamp': '1693934400000',   // Request timestamp
    'Content-Type': 'application/json'
}
```

### Endpoints

#### Plugin Execution
```http
POST /api/v1/plugins/{pluginId}/call
```

Request:
```json
{
    "payload": {
        "text": "Text to summarize...",
        "maxLength": 100
    },
    "metadata": {
        "version": "1.0.0"
    }
}
```

Response:
```json
{
    "success": true,
    "result": {
        "summary": "Summarized text...",
        "metrics": {
            "originalLength": 500,
            "summaryLength": 95
        }
    },
    "receipt": {
        "hash": "0x...",
        "signature": "0x...",
        "jobId": "0x12345678",
        "cost": "1000000000000000"
    },
    "metadata": {
        "executionTime": 2341,
        "pluginVersion": "1.0.0"
    }
}
```

#### Plugin Discovery
```http
GET /api/v1/plugins
```

Response:
```json
{
    "plugins": [
        {
            "id": 1,
            "name": "summarizer",
            "description": "AI text summarization",
            "pricePerCall": "0.001",
            "active": true,
            "totalCalls": "12345"
        }
    ]
}
```

### Error Handling

Standard HTTP status codes with JSON error responses:

```json
{
    "success": false,
    "error": "Insufficient escrow balance",
    "code": "INSUFFICIENT_FUNDS",
    "details": {
        "required": "0.001",
        "current": "0.0005"
    }
}
```

## SDK Usage

### JavaScript/Node.js

```bash
npm install duckgpt-sdk
```

```javascript
const { DuckGPTClient } = require('duckgpt-sdk');

const client = new DuckGPTClient({
    apiUrl: process.env.DUCKGPT_API_URL,
    privateKey: process.env.PRIVATE_KEY,
    rpcUrl: process.env.RPC_URL
});

// List available plugins
const plugins = await client.listPlugins();
console.log(plugins);

// Check balances
const balance = await client.getDuckBalance();
const escrow = await client.getEscrowBalance(1);

// Use plugins
const summary = await client.summarize('Long text here...');
const meme = await client.generateMeme('AI taking over the world');
const appraisal = await client.appriseNFT('0x...', 123);
```

### Python

```bash
pip install duckgpt-python
```

```python
from duckgpt import DuckGPTClient

client = DuckGPTClient(
    api_url=os.getenv('DUCKGPT_API_URL'),
    private_key=os.getenv('PRIVATE_KEY'),
    rpc_url=os.getenv('RPC_URL')
)

# Use plugins
result = client.summarize(
    text='Long text to summarize...',
    max_length=150,
    style='concise'
)

print(result['result']['summary'])

# Batch operations
from duckgpt.utils import BatchOperations

batch = BatchOperations(client)
results = batch.batch_summarize([
    'Text 1...',
    'Text 2...',
    'Text 3...'
])
```

### React/Browser

```bash
npm install duckgpt-sdk ethers
```

```jsx
import { DuckGPTClient } from 'duckgpt-sdk';
import { ethers } from 'ethers';

function App() {
    const [client, setClient] = useState(null);
    
    useEffect(() => {
        if (window.ethereum) {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = provider.getSigner();
            
            const duckClient = new DuckGPTClient({
                apiUrl: 'https://your-api-gateway-url',
                signer: signer,
                rpcUrl: 'https://your-rpc-url'
            });
            
            setClient(duckClient);
        }
    }, []);
    
    const handleSummarize = async (text) => {
        if (client) {
            const result = await client.summarize(text);
            return result.result.summary;
        }
    };
    
    return (
        <div>
            <SummarizeComponent onSummarize={handleSummarize} />
        </div>
    );
}
```

## Plugin Development

### Plugin Interface

All plugins must implement this standard interface:

```javascript
exports.handler = async (event) => {
    const { jobId, payload, timestamp } = event;
    
    try {
        // Validate input
        // Process request
        // Return standardized response
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                result: {
                    // Plugin-specific result data
                },
                jobId: jobId,
                timestamp: timestamp,
                version: '1.0.0'
            })
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({
                success: false,
                error: error.message
            })
        };
    }
};
```

### Plugin Metadata

Register plugins with comprehensive metadata:

```javascript
await pluginRegistry.register(
    "my-awesome-plugin",                    // Name
    "Description of what this plugin does", // Description  
    "https://github.com/user/plugin",       // Source URI
    ethers.parseEther("0.005"),            // Price per call
    verifierAddress,                        // Oracle address
    {
        maxResponseTimeMs: 30000,           // SLA: Max response time
        availabilityPercent: 9900,          // SLA: 99% uptime
        maxTokens: 1000                     // SLA: Max output tokens
    }
);
```

### Best Practices

1. **Deterministic Output**: Same input should produce same output when possible
2. **Error Handling**: Comprehensive error handling and user-friendly messages
3. **Resource Limits**: Respect memory and timeout constraints
4. **Security**: Validate all inputs, sanitize outputs
5. **Monitoring**: Include metrics and logging
6. **Documentation**: Clear usage examples and parameter descriptions

### Plugin Examples

#### Simple Text Processor

```javascript
exports.handler = async (event) => {
    const { jobId, payload } = event;
    const { text, operation = 'uppercase' } = payload;
    
    if (!text) {
        throw new Error('Text is required');
    }
    
    let result;
    switch (operation) {
        case 'uppercase':
            result = text.toUpperCase();
            break;
        case 'lowercase':
            result = text.toLowerCase();
            break;
        case 'reverse':
            result = text.split('').reverse().join('');
            break;
        default:
            throw new Error('Invalid operation');
    }
    
    return {
        statusCode: 200,
        body: JSON.stringify({
            success: true,
            result: {
                processedText: result,
                operation: operation,
                originalLength: text.length,
                processedLength: result.length
            },
            jobId: jobId,
            version: '1.0.0'
        })
    };
};
```

## Deployment Guide

### Local Development

1. **Start Local Blockchain**
```bash
npx hardhat node
```

2. **Deploy Contracts**
```bash
npm run deploy:contracts
```

3. **Start Services Locally**
```bash
# API Gateway
cd gateway && npm run offline

# Plugins (in separate terminals)
cd plugins/summarizer && npm run offline
cd plugins/meme-generator && npm run offline
cd plugins/nft-appraiser && npm run offline
```

### Mainnet Deployment

1. **Configure Environment**
```bash
# .env
RPC_URL=https://rpc.duckchain.io/
PRIVATE_KEY=your-testnet-private-key
CHAIN_ID=5545
```

2. **Deploy to Mainnet**
```bash
npm run deploy:contracts:mainnet
npm run deploy:infrastructure
```

3. **Verify Contracts**
```bash
cd contracts
npx hardhat verify --network mainnet CONTRACT_ADDRESS "constructor-args"
```

### Production Deployment

1. **Security Checklist**
- [x] All private keys stored securely (AWS KMS, environment variables)
- [x] Rate limiting configured
- [x] Monitoring and alerting setup
- [x] Smart contracts audited
- [x] Infrastructure secured (WAF, VPC)

2. **Deploy Infrastructure**
```bash
export STAGE=prod
npm run deploy:contracts:mainnet
npm run deploy:infrastructure
```

3. **Post-Deployment**
```bash
# Verify all services are running
npm run test:integration

# Setup monitoring dashboards
# Configure backup and disaster recovery
# Update documentation
```

### CI/CD Pipeline

GitHub Actions workflow example:

```yaml
name: Deploy DuckGPT
on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test

  deploy-contracts:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm run deploy:contracts:testnet
        env:
          PRIVATE_KEY: ${{ secrets.PRIVATE_KEY }}
          RPC_URL: ${{ secrets.RPC_URL }}

  deploy-infrastructure:
    needs: deploy-contracts
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm run deploy:infrastructure
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

## Security Considerations

### Smart Contract Security

- **Reentrancy Protection**: All state-changing functions use ReentrancyGuard
- **Access Control**: Proper role-based permissions
- **Integer Overflow**: Using Solidity 0.8+ built-in checks
- **Oracle Security**: Multi-signature verification for critical operations

### API Security

- **Authentication**: Signature-based request authentication
- **Rate Limiting**: Per-user and global rate limits
- **Input Validation**: Comprehensive payload validation
- **CORS**: Properly configured cross-origin policies

### Infrastructure Security

- **AWS Security**: IAM roles with minimal required permissions
- **Encryption**: Data encrypted in transit and at rest
- **Network Security**: VPC with private subnets
- **Monitoring**: CloudWatch alarms for suspicious activity

### Best Practices

1. **Private Key Management**: Never expose private keys in code
2. **Environment Variables**: Use secure secret management
3. **Regular Updates**: Keep dependencies updated
4. **Audit Logging**: Log all significant operations
5. **Backup Strategy**: Regular backups of critical data

## Troubleshooting

### Common Issues

#### "Insufficient escrow" Error
```bash
# Check escrow balance
curl -X GET "https://api-url/user/0xYOUR_ADDRESS/escrow/1"

# Top up escrow
await client.prepayPlugin(1, ethers.parseEther("0.1"));
```

#### "Plugin not found" Error
```bash
# Check plugin registry
await pluginRegistry.plugins(1);

# Verify plugin is active
const plugin = await client.getPlugin(1);
console.log(plugin.active);
```

#### "Transaction failed" Error
```bash
# Check gas settings
const gasPrice = await provider.getGasPrice();
console.log(ethers.formatUnits(gasPrice, 'gwei'));

# Increase gas limit
const tx = await contract.method({ gasLimit: 300000 });
```

### Debug Mode

Enable detailed logging:

```bash
# Enable debug logs
export DEBUG=duckgpt:*
export LOG_LEVEL=debug

# Run with verbose output
npm run dev -- --verbose
```

### Health Checks

```bash
# Check contract deployment
npx hardhat run scripts/health-check.js --network mainnet

# Check API endpoints
curl https://your-api-gateway-url/health

# Check plugin status
curl https://your-api-gateway-url/api/v1/plugins
```

---

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

This project is licensed under the MIT License - see [LICENSE](LICENSE) file for details.

## Acknowledgments

- OpenZeppelin for smart contract libraries
- AWS for serverless infrastructure
- Anthropic for AI capabilities
- The DeFi and Web3 community for inspiration