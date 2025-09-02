// plugins/meme-generator/src/handler.js
const AWS = require('aws-sdk');
const sharp = require('sharp');
const { createCanvas, loadImage, registerFont } = require('canvas');

const s3 = new AWS.S3();
const bedrock = new AWS.BedrockRuntime({
    region: process.env.AWS_REGION || 'us-east-1'
});

// Meme templates configuration
const MEME_TEMPLATES = {
    drake: {
        name: 'Drake Pointing',
        width: 720,
        height: 720,
        textAreas: [
            { x: 360, y: 180, width: 350, align: 'left' }, // Top text
            { x: 360, y: 540, width: 350, align: 'left' }  // Bottom text
        ]
    },
    distracted: {
        name: 'Distracted Boyfriend',
        width: 800,
        height: 450,
        textAreas: [
            { x: 400, y: 50, width: 200, align: 'center' }  // Top text
        ]
    },
    expanding: {
        name: 'Expanding Brain',
        width: 680,
        height: 900,
        textAreas: [
            { x: 350, y: 112, width: 320, align: 'left' },
            { x: 350, y: 337, width: 320, align: 'left' },
            { x: 350, y: 562, width: 320, align: 'left' },
            { x: 350, y: 787, width: 320, align: 'left' }
        ]
    }
};

exports.handler = async (event) => {
    console.log('Meme Generator plugin called:', JSON.stringify(event, null, 2));
    
    try {
        const { jobId, payload, timestamp } = event;
        const { prompt, template = 'drake', style = 'funny' } = payload;
        
        // Generate meme text using AI
        const memeText = await generateMemeText(prompt, template, style);
        
        // Create meme image
        const imageBuffer = await createMemeImage(template, memeText);
        
        // Upload to S3
        const imageKey = `memes/${jobId}.png`;
        await s3.putObject({
            Bucket: process.env.S3_BUCKET,
            Key: imageKey,
            Body: imageBuffer,
            ContentType: 'image/png',
            ACL: 'public-read'
        }).promise();
        
        const imageUrl = `https://${process.env.S3_BUCKET}.s3.amazonaws.com/${imageKey}`;
        
        const result = {
            imageUrl: imageUrl,
            template: template,
            texts: memeText,
            style: style,
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
        console.error('Meme Generator error:', error);
        
        return {
            statusCode: 500,
            body: JSON.stringify({
                success: false,
                error: error.message
            })
        };
    }
};

async function generateMemeText(prompt, template, style) {
    const templateConfig = MEME_TEMPLATES[template];
    const textCount = templateConfig.textAreas.length;
    
    const systemPrompt = `You are a meme text generator. Generate ${textCount} short, punchy text${textCount > 1 ? 's' : ''} for a ${template} meme template. Style: ${style}. Each text should be under 50 characters and capture the essence of: ${prompt}`;
    
    const bedrockResponse = await bedrock.invokeModel({
        modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
            anthropic_version: 'bedrock-2023-05-31',
            max_tokens: 200,
            messages: [
                {
                    role: 'user',
                    content: `${systemPrompt}\n\nRespond with exactly ${textCount} line${textCount > 1 ? 's' : ''}, one per line, no numbering or bullets.`
                }
            ]
        })
    }).promise();
    
    const responseBody = JSON.parse(new TextDecoder().decode(bedrockResponse.body));
    const generatedText = responseBody.content[0].text.trim();
    
    return generatedText.split('\n').slice(0, textCount).map(t => t.trim());
}

async function createMemeImage(template, texts) {
    const config = MEME_TEMPLATES[template];
    
    // Create canvas
    const canvas = createCanvas(config.width, config.height);
    const ctx = canvas.getContext('2d');
    
    // Load base template image (stored in S3 or bundled)
    const templateImageUrl = `https://${process.env.S3_BUCKET}.s3.amazonaws.com/templates/${template}.jpg`;
    
    try {
        const baseImage = await loadImage(templateImageUrl);
        ctx.drawImage(baseImage, 0, 0, config.width, config.height);
    } catch (error) {
        // Fallback: create colored background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, config.width, config.height);
    }
    
    // Configure text style
    ctx.fillStyle = '#000000';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.font = 'bold 36px Impact, Arial';
    ctx.textAlign = 'center';
    
    // Add texts to designated areas
    texts.forEach((text, index) => {
        if (index < config.textAreas.length) {
            const area = config.textAreas[index];
            
            // Word wrap if needed
            const wrappedLines = wrapText(ctx, text, area.width);
            
            wrappedLines.forEach((line, lineIndex) => {
                const y = area.y + (lineIndex * 40);
                
                // Draw stroke (outline)
                ctx.strokeText(line, area.x, y);
                // Draw fill
                ctx.fillText(line, area.x, y);
            });
        }
    });
    
    // Convert to buffer
    return canvas.toBuffer('image/png');
}

function wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = words[0];
    
    for (let i = 1; i < words.length; i++) {
        const testLine = currentLine + ' ' + words[i];
        const metrics = ctx.measureText(testLine);
        
        if (metrics.width > maxWidth && i > 0) {
            lines.push(currentLine);
            currentLine = words[i];
        } else {
            currentLine = testLine;
        }
    }
    lines.push(currentLine);
    
    return lines;
}
