// gateway/src/gateway.js - Main API Gateway Lambda
const AWS = require('aws-sdk');
const { ethers } = require('ethers');
const { validateRequest, authenticateUser } = require('./auth');
const { signReceipt, verifyReceipt } = require('./oracle');
const { logCall, updateMetrics } = require('./utils');

const lambda = new AWS.Lambda();
const dynamodb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();

// Environment variables
const {
    DUCK_TOKEN_ADDRESS,
    PLUGIN_REGISTRY_ADDRESS,
    USAGE_METER_ADDRESS,
    RPC_URL,
    VERIFIER_PRIVATE_KEY,
    DYNAMODB_TABLE,
    S3_BUCKET
} = process.env;

const provider = new ethers.JsonRpcProvider(RPC_URL);
const verifierWallet = new ethers.Wallet(VERIFIER_PRIVATE_KEY, provider);

// Plugin Registry contract instance
const pluginRegistryABI = [
    "function plugins(uint256) view returns (string name, string description, string uri, address owner, uint256 pricePerCall, uint256 version, address verifierPubKey, bool active, uint256 totalCalls, uint256 totalEarnings, uint256 createdAt, uint256 updatedAt)"
];
const pluginRegistry = new ethers.Contract(PLUGIN_REGISTRY_ADDRESS, pluginRegistryABI, provider);

// Usage Meter contract instance  
const usageMeterABI = [
    "function getUserEscrow(address user, uint256 pluginId) view returns (uint256)",
    "function consume(uint256 pluginId, bytes32 receiptHash, uint256 cost, bytes signature) external"
];
const usageMeter = new ethers.Contract(USAGE_METER_ADDRESS, usageMeterABI, verifierWallet);

exports.handler = async (event) => {
    console.log('Gateway request:', JSON.stringify(event, null, 2));
    
    try {
        // Parse request
        const { httpMethod, path, body, headers, requestContext } = event;
        const requestId = requestContext.requestId;
        
        // CORS headers
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,X-User-Address,X-Signature,X-Timestamp',
            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
        };
        
        if (httpMethod === 'OPTIONS') {
            return {
                statusCode: 200,
                headers: corsHeaders,
                body: ''
            };
        }
        
        // Parse path to extract plugin ID
        const pathMatch = path.match(/^\/api\/v1\/plugins\/(\d+)\/call$/);
        if (!pathMatch) {
            return errorResponse(400, 'Invalid endpoint', corsHeaders);
        }
        
        const pluginId = parseInt(pathMatch[1]);
        const requestBody = JSON.parse(body || '{}');
        
        // Authenticate and validate request
        const authResult = await authenticateUser(headers, requestBody);
        if (!authResult.valid) {
            return errorResponse(401, authResult.error, corsHeaders);
        }
        
        const userAddress = authResult.userAddress;
        
        // Validate request payload
        const validationResult = await validateRequest(requestBody, pluginId);
        if (!validationResult.valid) {
            return errorResponse(400, validationResult.error, corsHeaders);
        }
        
        // Get plugin info from registry
        const plugin = await pluginRegistry.plugins(pluginId);
        if (!plugin.active) {
            return errorResponse(404, 'Plugin not found or inactive', corsHeaders);
        }
        
        // Check user has sufficient escrow
        const userEscrow = await usageMeter.getUserEscrow(userAddress, pluginId);
        if (userEscrow < plugin.pricePerCall) {
            return errorResponse(402, 'Insufficient escrow. Please prepay for plugin usage.', corsHeaders);
        }
        
        // Generate job ID
        const jobId = generateJobId(requestId, userAddress, pluginId);
        const inputHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(requestBody.payload)));
        
        // Call plugin Lambda
        const pluginResponse = await callPlugin(plugin.name, requestBody.payload, jobId);
        if (!pluginResponse.success) {
            return errorResponse(500, `Plugin execution failed: ${pluginResponse.error}`, corsHeaders);
        }
        
        // Store large outputs in S3
        let outputData = pluginResponse.result;
        let outputUri = null;
        
        if (JSON.stringify(outputData).length > 100000) { // > 100KB
            const key = `outputs/${jobId}.json`;
            await s3.putObject({
                Bucket: S3_BUCKET,
                Key: key,
                Body: JSON.stringify(outputData),
                ContentType: 'application/json'
            }).promise();
            
            outputUri = `s3://${S3_BUCKET}/${key}`;
            outputData = { uri: outputUri, type: 'large_output' };
        }
        
        const outputHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(outputData)));
        
        // Create and sign receipt
        const receipt = {
            jobId: jobId,
            caller: userAddress,
            pluginId: pluginId,
            inputHash: inputHash,
            outputHash: outputHash,
            cost: plugin.pricePerCall.toString(),
            timestamp: Math.floor(Date.now() / 1000)
        };
        
        const receiptHash = createReceiptHash(receipt);
        const signature = await signReceipt(receiptHash, verifierWallet);
        
        // Consume usage on-chain (async)
        consumeUsageAsync(pluginId, receiptHash, plugin.pricePerCall, signature);
        
        // Log call for analytics
        await logCall({
            jobId,
            pluginId,
            userAddress,
            cost: plugin.pricePerCall.toString(),
            timestamp: receipt.timestamp,
            success: true
        });
        
        // Update metrics
        await updateMetrics(pluginId, plugin.pricePerCall);
        
        return {
            statusCode: 200,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                success: true,
                jobId: jobId,
                result: outputData,
                receipt: {
                    hash: receiptHash,
                    signature: signature,
                    ...receipt
                },
                metadata: {
                    pluginName: plugin.name,
                    version: plugin.version.toString(),
                    executionTime: pluginResponse.executionTime
                }
            })
        };
        
    } catch (error) {
        console.error('Gateway error:', error);
        
        return errorResponse(500, 'Internal server error', corsHeaders || {});
    }
};

async function callPlugin(pluginName, payload, jobId) {
    const functionName = `duckgpt-${pluginName}-${process.env.STAGE}`;
    
    try {
        const startTime = Date.now();
        
        const result = await lambda.invoke({
            FunctionName: functionName,
            InvocationType: 'RequestResponse',
            Payload: JSON.stringify({
                jobId: jobId,
                payload: payload,
                timestamp: Math.floor(Date.now() / 1000)
            })
        }).promise();
        
        const executionTime = Date.now() - startTime;
        const response = JSON.parse(result.Payload);
        
        if (result.StatusCode !== 200 || response.errorMessage) {
            return {
                success: false,
                error: response.errorMessage || 'Plugin execution failed'
            };
        }
        
        return {
            success: true,
            result: JSON.parse(response.body).result,
            executionTime: executionTime
        };
        
    } catch (error) {
        console.error(`Plugin call failed for ${pluginName}:`, error);
        return {
            success: false,
            error: error.message
        };
    }
}

async function consumeUsageAsync(pluginId, receiptHash, cost, signature) {
    try {
        const tx = await usageMeter.consume(pluginId, receiptHash, cost, signature);
        console.log(`Usage consumed for plugin ${pluginId}, tx: ${tx.hash}`);
    } catch (error) {
        console.error('Failed to consume usage on-chain:', error);
        // In production, this would trigger a retry mechanism
    }
}

function generateJobId(requestId, userAddress, pluginId) {
    const timestamp = Date.now();
    return ethers.keccak256(
        ethers.toUtf8Bytes(`${requestId}-${userAddress}-${pluginId}-${timestamp}`)
    ).substring(0, 18); // 8 bytes hex
}

function createReceiptHash(receipt) {
    return ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
            ['uint256', 'address', 'uint256', 'bytes32', 'bytes32', 'uint256', 'uint256'],
            [receipt.jobId, receipt.caller, receipt.pluginId, receipt.inputHash, 
             receipt.outputHash, receipt.cost, receipt.timestamp]
        )
    );
}

function errorResponse(statusCode, message, headers) {
    return {
        statusCode,
        headers,
        body: JSON.stringify({
            success: false,
            error: message
        })
    };
}
