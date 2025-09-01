// gateway/src/auth.js - Authentication and validation
const { ethers } = require('ethers');
const crypto = require('crypto');

const NONCE_EXPIRY = 300000; // 5 minutes
const nonceCache = new Map();

async function authenticateUser(headers, body) {
    try {
        const userAddress = headers['x-user-address'];
        const signature = headers['x-signature'];
        const timestamp = headers['x-timestamp'];
        
        if (!userAddress || !signature || !timestamp) {
            return { valid: false, error: 'Missing authentication headers' };
        }
        
        // Check timestamp (prevent replay attacks)
        const now = Date.now();
        const requestTime = parseInt(timestamp);
        
        if (Math.abs(now - requestTime) > NONCE_EXPIRY) {
            return { valid: false, error: 'Request expired' };
        }
        
        // Create message to verify
        const message = createAuthMessage(userAddress, timestamp, body);
        const messageHash = ethers.hashMessage(message);
        
        // Verify signature
        try {
            const recoveredAddress = ethers.recoverAddress(messageHash, signature);
            
            if (recoveredAddress.toLowerCase() !== userAddress.toLowerCase()) {
                return { valid: false, error: 'Invalid signature' };
            }
            
            // Check for replay attack
            const noncePair = `${userAddress}-${timestamp}`;
            if (nonceCache.has(noncePair)) {
                return { valid: false, error: 'Duplicate request' };
            }
            
            // Store nonce
            nonceCache.set(noncePair, true);
            
            // Cleanup old nonces (simple implementation)
            if (nonceCache.size > 10000) {
                const entries = Array.from(nonceCache.entries());
                entries.slice(0, 5000).forEach(([key]) => nonceCache.delete(key));
            }
            
            return { valid: true, userAddress: userAddress };
            
        } catch (error) {
            return { valid: false, error: 'Signature verification failed' };
        }
        
    } catch (error) {
        console.error('Authentication error:', error);
        return { valid: false, error: 'Authentication failed' };
    }
}

function createAuthMessage(userAddress, timestamp, body) {
    const bodyHash = crypto.createHash('sha256')
        .update(JSON.stringify(body))
        .digest('hex');
    
    return `DuckGPT Auth\nAddress: ${userAddress}\nTimestamp: ${timestamp}\nBody: ${bodyHash}`;
}

async function validateRequest(body, pluginId) {
    try {
        // Validate required fields
        if (!body.payload) {
            return { valid: false, error: 'Missing payload' };
        }
        
        // Validate payload size (max 1MB)
        const payloadSize = JSON.stringify(body.payload).length;
        if (payloadSize > 1048576) {
            return { valid: false, error: 'Payload too large' };
        }
        
        // Plugin-specific validation
        const validationRules = {
            1: validateSummarizerPayload,    // Summarizer
            2: validateMemeGeneratorPayload, // Meme Generator  
            3: validateNFTAppraiserPayload   // NFT Appraiser
        };
        
        const validator = validationRules[pluginId];
        if (validator) {
            const result = await validator(body.payload);
            if (!result.valid) {
                return result;
            }
        }
        
        return { valid: true };
        
    } catch (error) {
        return { valid: false, error: 'Validation failed' };
    }
}

function validateSummarizerPayload(payload) {
    if (!payload.text || typeof payload.text !== 'string') {
        return { valid: false, error: 'Missing or invalid text field' };
    }
    
    if (payload.text.length > 50000) {
        return { valid: false, error: 'Text too long (max 50k chars)' };
    }
    
    if (payload.maxLength && (payload.maxLength < 10 || payload.maxLength > 1000)) {
        return { valid: false, error: 'Invalid maxLength (10-1000)' };
    }
    
    return { valid: true };
}

function validateMemeGeneratorPayload(payload) {
    if (!payload.prompt || typeof payload.prompt !== 'string') {
        return { valid: false, error: 'Missing or invalid prompt field' };
    }
    
    if (payload.prompt.length > 500) {
        return { valid: false, error: 'Prompt too long (max 500 chars)' };
    }
    
    return { valid: true };
}

function validateNFTAppraiserPayload(payload) {
    if (!payload.contractAddress || !payload.tokenId) {
        return { valid: false, error: 'Missing contractAddress or tokenId' };
    }
    
    if (!ethers.isAddress(payload.contractAddress)) {
        return { valid: false, error: 'Invalid contract address' };
    }
    
    return { valid: true };
}

module.exports = {
    authenticateUser,
    validateRequest,
    createAuthMessage
};
