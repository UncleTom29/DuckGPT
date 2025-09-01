// gateway/src/oracle.js - Oracle receipt signing and verification
const { ethers } = require('ethers');

async function signReceipt(receiptHash, wallet) {
    try {
        const signature = await wallet.signMessage(ethers.getBytes(receiptHash));
        return signature;
    } catch (error) {
        console.error('Receipt signing failed:', error);
        throw new Error('Failed to sign receipt');
    }
}

function verifyReceipt(receiptHash, signature, expectedSigner) {
    try {
        const recoveredAddress = ethers.verifyMessage(ethers.getBytes(receiptHash), signature);
        return recoveredAddress.toLowerCase() === expectedSigner.toLowerCase();
    } catch (error) {
        console.error('Receipt verification failed:', error);
        return false;
    }
}

function createReceiptData(jobId, caller, pluginId, inputHash, outputHash, cost, timestamp) {
    return {
        jobId,
        caller,
        pluginId,
        inputHash,
        outputHash,
        cost: cost.toString(),
        timestamp
    };
}

module.exports = {
    signReceipt,
    verifyReceipt,
    createReceiptData
};