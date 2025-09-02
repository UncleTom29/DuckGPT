// plugins/summarizer/src/handler.js
const AWS = require('aws-sdk');

const bedrock = new AWS.BedrockRuntime({
    region: process.env.AWS_REGION || 'us-east-1'
});

exports.handler = async (event) => {
    console.log('Summarizer plugin called:', JSON.stringify(event, null, 2));
    
    try {
        const { jobId, payload, timestamp } = event;
        const { text, maxLength = 150, style = 'concise' } = payload;
        
        // Validate input
        if (!text || typeof text !== 'string') {
            throw new Error('Invalid text input');
        }
        
        if (text.length > 50000) {
            throw new Error('Text too long (max 50k characters)');
        }
        
        // Prepare prompt based on style
        const stylePrompts = {
            concise: 'Provide a concise summary',
            detailed: 'Provide a detailed summary with key points',
            bullet: 'Summarize in bullet points',
            executive: 'Provide an executive summary'
        };
        
        const systemPrompt = `${stylePrompts[style] || stylePrompts.concise} of the following text in approximately ${maxLength} words. Focus on the main ideas and key information.`;
        
        const prompt = `${systemPrompt}\n\nText to summarize:\n${text}`;
        
        // Call Bedrock Claude
        const bedrockResponse = await bedrock.invokeModel({
            modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
            contentType: 'application/json',
            accept: 'application/json',
            body: JSON.stringify({
                anthropic_version: 'bedrock-2023-05-31',
                max_tokens: Math.min(maxLength * 2, 1000),
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ]
            })
        }).promise();
        
        const responseBody = JSON.parse(new TextDecoder().decode(bedrockResponse.body));
        const summary = responseBody.content[0].text;
        
        // Calculate deterministic metrics
        const metrics = {
            originalLength: text.length,
            summaryLength: summary.length,
            compressionRatio: (text.length / summary.length).toFixed(2),
            wordCount: summary.split(/\s+/).length,
            estimatedReadingTime: Math.ceil(summary.split(/\s+/).length / 200) // 200 WPM
        };
        
        const result = {
            summary: summary.trim(),
            style: style,
            metrics: metrics,
            jobId: jobId,
            timestamp: timestamp,
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
        console.error('Summarizer error:', error);
        
        return {
            statusCode: 500,
            body: JSON.stringify({
                success: false,
                error: error.message
            })
        };
    }
};
