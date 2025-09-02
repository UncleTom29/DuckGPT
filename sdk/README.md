# DuckGPT SDK

[![npm version](https://badge.fury.io/js/duckgpt-sdk.svg)](https://badge.fury.io/js/duckgpt-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A JavaScript SDK for interacting with the DuckGPT blockchain-based AI plugin ecosystem.

## Installation

```bash
npm install duckgpt-sdk
```

## Usage
```bash
javascriptconst { DuckGPTClient } = require('duckgpt-sdk');

const client = new DuckGPTClient({
    apiUrl: 'https://localhost:8000/api/v1',
    privateKey: 'your_private_key',
    rpcUrl: 'your_rpc_url'
});

// Summarize text
const result = await client.summarize('Long text to summarize...');
console.log(result);
```

## Features

🔗 Blockchain-based plugin system
🤖 AI-powered plugins (summarization, meme generation, NFT appraisal)
💰 Automatic escrow management
🔐 Secure authentication with wallet signatures
📝 Full TypeScript support
⚡ Built-in retry mechanisms and error handling