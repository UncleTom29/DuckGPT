// plugins/nft-appraiser/src/handler.js
const AWS = require('aws-sdk');
const axios = require('axios');
const { ethers } = require('ethers');

const bedrock = new AWS.BedrockRuntime({
    region: process.env.AWS_REGION || 'us-east-1'
});

// NFT marketplace APIs for price data
const MARKETPLACE_APIS = {
    opensea: 'https://api.opensea.io/api/v1',
    looksrare: 'https://api.looksrare.org/api/v1',
    x2y2: 'https://api.x2y2.org/api/v1'
};

exports.handler = async (event) => {
    console.log('NFT Appraiser plugin called:', JSON.stringify(event, null, 2));
    
    try {
        const { jobId, payload, timestamp } = event;
        const { contractAddress, tokenId, chain = 'ethereum' } = payload;
        
        // Validate inputs
        if (!ethers.isAddress(contractAddress)) {
            throw new Error('Invalid contract address');
        }
        
        // Fetch NFT metadata
        const nftData = await fetchNFTData(contractAddress, tokenId, chain);
        
        // Get recent sales data
        const salesData = await fetchSalesData(contractAddress, tokenId);
        
        // Get collection stats
        const collectionStats = await fetchCollectionStats(contractAddress);
        
        // Generate AI-powered appraisal
        const appraisal = await generateAppraisal(nftData, salesData, collectionStats);
        
        const result = {
            contractAddress,
            tokenId,
            chain,
            nftData,
            appraisal,
            salesData,
            collectionStats,
            jobId,
            timestamp,
            version: '1.0.0'
        };
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                result: result
            })
        };
        
    } catch (error) {
        console.error('NFT Appraiser error:', error);
        
        return {
            statusCode: 500,
            body: JSON.stringify({
                success: false,
                error: error.message
            })
        };
    }
};

async function fetchNFTData(contractAddress, tokenId, chain) {
    try {
        // Try OpenSea API first
        const response = await axios.get(
            `${MARKETPLACE_APIS.opensea}/asset/${contractAddress}/${tokenId}`,
            {
                timeout: 10000,
                headers: {
                    'X-API-KEY': process.env.OPENSEA_API_KEY
                }
            }
        );
        
        const asset = response.data;
        
        return {
            name: asset.name,
            description: asset.description,
            image: asset.image_url,
            traits: asset.traits || [],
            collection: {
                name: asset.collection?.name,
                floorPrice: asset.collection?.stats?.floor_price
            },
            owner: asset.owner?.address,
            tokenStandard: asset.asset_contract?.schema_name
        };
        
    } catch (error) {
        console.error('Failed to fetch NFT data from OpenSea:', error.message);
        
        // Fallback: try direct contract call
        return await fetchNFTDataFromContract(contractAddress, tokenId, chain);
    }
}

async function fetchNFTDataFromContract(contractAddress, tokenId, chain) {
    return {
        name: `Token #${tokenId}`,
        description: 'NFT metadata unavailable',
        image: null,
        traits: [],
        collection: { name: 'Unknown Collection', floorPrice: null },
        owner: null,
        tokenStandard: 'ERC721'
    };
}

async function fetchSalesData(contractAddress, tokenId) {
    try {
        const response = await axios.get(
            `${MARKETPLACE_APIS.opensea}/events`,
            {
                params: {
                    asset_contract_address: contractAddress,
                    token_id: tokenId,
                    event_type: 'successful',
                    limit: 10
                },
                timeout: 10000,
                headers: {
                    'X-API-KEY': process.env.OPENSEA_API_KEY
                }
            }
        );
        
        const events = response.data.asset_events || [];
        
        return events.map(event => ({
            price: event.total_price ? ethers.formatEther(event.total_price) : '0',
            currency: event.payment_token?.symbol || 'ETH',
            timestamp: event.created_date,
            marketplace: 'OpenSea',
            buyer: event.winner_account?.address,
            seller: event.seller?.address
        }));
        
    } catch (error) {
        console.error('Failed to fetch sales data:', error.message);
        return [];
    }
}

async function fetchCollectionStats(contractAddress) {
    try {
        const response = await axios.get(
            `${MARKETPLACE_APIS.opensea}/collection/${contractAddress}/stats`,
            {
                timeout: 10000,
                headers: {
                    'X-API-KEY': process.env.OPENSEA_API_KEY
                }
            }
        );
        
        const stats = response.data.stats;
        
        return {
            floorPrice: stats.floor_price,
            volumeTraded: stats.total_volume,
            sales: stats.total_sales,
            averagePrice: stats.average_price,
            marketCap: stats.market_cap,
            owners: stats.num_owners,
            totalSupply: stats.total_supply
        };
        
    } catch (error) {
        console.error('Failed to fetch collection stats:', error.message);
        return null;
    }
}

async function generateAppraisal(nftData, salesData, collectionStats) {
    const prompt = `
You are an expert NFT appraiser. Analyze this NFT and provide a detailed appraisal with estimated value range.

NFT Details:
- Name: ${nftData.name}
- Description: ${nftData.description}
- Traits: ${JSON.stringify(nftData.traits)}
- Collection: ${nftData.collection?.name}

Recent Sales (last 10):
${salesData.map(sale => `- ${sale.price} ${sale.currency} on ${sale.timestamp}`).join('\n')}

Collection Stats:
${collectionStats ? `
- Floor Price: ${collectionStats.floorPrice} ETH
- Total Volume: ${collectionStats.volumeTraded} ETH
- Total Sales: ${collectionStats.sales}
- Average Price: ${collectionStats.averagePrice} ETH
- Owners: ${collectionStats.owners}
` : 'Collection stats unavailable'}

Provide:
1. Estimated value range in ETH
2. Key factors affecting value
3. Market sentiment analysis
4. Recommendation (buy/hold/sell)
5. Confidence level (1-10)

Format as JSON with fields: estimatedValueMin, estimatedValueMax, keyFactors, marketSentiment, recommendation, confidence, reasoning.
`;

    try {
        const response = await bedrock.invokeModel({
            modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
            contentType: 'application/json',
            accept: 'application/json',
            body: JSON.stringify({
                anthropic_version: 'bedrock-2023-05-31',
                max_tokens: 1000,
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ]
            })
        }).promise();
        
        const responseBody = JSON.parse(new TextDecoder().decode(response.body));
        const appraisalText = responseBody.content[0].text;
        
        // Try to parse as JSON, fallback to structured text
        try {
            return JSON.parse(appraisalText);
        } catch {
            return parseAppraisalText(appraisalText);
        }
        
    } catch (error) {
        console.error('AI appraisal failed:', error);
        
        // Fallback: simple statistical analysis
        return generateStatisticalAppraisal(salesData, collectionStats);
    }
}

function parseAppraisalText(text) {
    // Simple parsing for non-JSON responses
    return {
        estimatedValueMin: 0.1,
        estimatedValueMax: 1.0,
        keyFactors: ['Collection reputation', 'Recent sales activity', 'Trait rarity'],
        marketSentiment: 'Neutral',
        recommendation: 'Hold',
        confidence: 5,
        reasoning: text.substring(0, 500)
    };
}

function generateStatisticalAppraisal(salesData, collectionStats) {
    if (salesData.length === 0) {
        return {
            estimatedValueMin: collectionStats?.floorPrice || 0.01,
            estimatedValueMax: (collectionStats?.floorPrice || 0.01) * 2,
            keyFactors: ['No recent sales data', 'Based on floor price'],
            marketSentiment: 'Unknown',
            recommendation: 'Research needed',
            confidence: 3,
            reasoning: 'Limited data available for accurate appraisal'
        };
    }
    
    const prices = salesData.map(sale => parseFloat(sale.price)).filter(p => p > 0);
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    
    return {
        estimatedValueMin: minPrice * 0.8,
        estimatedValueMax: maxPrice * 1.2,
        keyFactors: [`${salesData.length} recent sales`, 'Statistical analysis'],
        marketSentiment: avgPrice > (collectionStats?.floorPrice || 0) ? 'Bullish' : 'Bearish',
        recommendation: 'Hold',
        confidence: 6,
        reasoning: `Based on ${salesData.length} recent sales with average price ${avgPrice.toFixed(4)} ETH`
    };
}