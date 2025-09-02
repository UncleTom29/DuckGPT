/**
 * DuckGPT SDK - JavaScript Client Library
 * 
 * A comprehensive SDK for interacting with the DuckGPT blockchain-based
 * AI plugin ecosystem.
 * 
 * @version 1.1.0
 * @author Tomiwa Adeyemi
 * @license MIT
 */

const DuckGPTClient = require('./lib/client');
const { validatePayload, createAuthHeaders, parseReceipt, formatError, retryOperation } = require('./lib/utils');

/**
 * Main DuckGPT SDK exports
 */
module.exports = {
    // Main client class
    DuckGPTClient,
    
    // Utility functions
    validatePayload,
    createAuthHeaders,
    parseReceipt,
    formatError,
    retryOperation,
    
    // Version info
    version: require('./package.json').version
};

// ES6 export compatibility
module.exports.default = DuckGPTClient;