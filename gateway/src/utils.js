// gateway/src/utils.js - Utility functions
const AWS = require('aws-sdk');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const cloudwatch = new AWS.CloudWatch();

async function logCall(callData) {
    const item = {
        id: callData.jobId,
        pluginId: callData.pluginId,
        userAddress: callData.userAddress,
        cost: callData.cost,
        timestamp: callData.timestamp,
        success: callData.success,
        ttl: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 days TTL
    };
    
    try {
        await dynamodb.put({
            TableName: process.env.DYNAMODB_TABLE,
            Item: item
        }).promise();
    } catch (error) {
        console.error('Failed to log call:', error);
    }
}

async function updateMetrics(pluginId, cost) {
    try {
        // Send metrics to CloudWatch
        await cloudwatch.putMetricData({
            Namespace: 'DuckGPT',
            MetricData: [
                {
                    MetricName: 'PluginCalls',
                    Dimensions: [
                        {
                            Name: 'PluginId',
                            Value: pluginId.toString()
                        }
                    ],
                    Value: 1,
                    Unit: 'Count',
                    Timestamp: new Date()
                },
                {
                    MetricName: 'Revenue',
                    Dimensions: [
                        {
                            Name: 'PluginId', 
                            Value: pluginId.toString()
                        }
                    ],
                    Value: parseFloat(ethers.formatEther(cost)),
                    Unit: 'None',
                    Timestamp: new Date()
                }
            ]
        }).promise();
    } catch (error) {
        console.error('Failed to update metrics:', error);
    }
}

function generateSecureNonce() {
    return crypto.randomBytes(32).toString('hex');
}

async function getRateLimitStatus(userAddress, pluginId) {
    const key = `${userAddress}-${pluginId}`;
    const window = Math.floor(Date.now() / (60 * 1000)); // 1-minute windows
    
    try {
        const result = await dynamodb.get({
            TableName: `${process.env.DYNAMODB_TABLE}-ratelimit`,
            Key: { id: `${key}-${window}` }
        }).promise();
        
        const currentCount = result.Item?.count || 0;
        const limit = 100; // 100 calls per minute
        
        return {
            allowed: currentCount < limit,
            remaining: Math.max(0, limit - currentCount),
            resetTime: (window + 1) * 60 * 1000
        };
    } catch (error) {
        console.error('Rate limit check failed:', error);
        return { allowed: true, remaining: 100, resetTime: Date.now() + 60000 };
    }
}

async function incrementRateLimit(userAddress, pluginId) {
    const key = `${userAddress}-${pluginId}`;
    const window = Math.floor(Date.now() / (60 * 1000));
    
    try {
        await dynamodb.update({
            TableName: `${process.env.DYNAMODB_TABLE}-ratelimit`,
            Key: { id: `${key}-${window}` },
            UpdateExpression: 'ADD #count :val SET #ttl = :ttl',
            ExpressionAttributeNames: {
                '#count': 'count',
                '#ttl': 'ttl'
            },
            ExpressionAttributeValues: {
                ':val': 1,
                ':ttl': Math.floor(Date.now() / 1000) + 3600 // 1 hour TTL
            }
        }).promise();
    } catch (error) {
        console.error('Failed to increment rate limit:', error);
    }
}

module.exports = {
    logCall,
    updateMetrics,
    generateSecureNonce,
    getRateLimitStatus,
    incrementRateLimit
};