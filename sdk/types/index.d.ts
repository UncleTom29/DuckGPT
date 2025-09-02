declare module 'duckgpt-sdk' {
    import { Wallet } from 'ethers';

    export interface DuckGPTClientOptions {
        apiUrl?: string;
        privateKey?: string;
        rpcUrl?: string;
        timeout?: number;
    }

    export interface PluginCallResult {
        success: boolean;
        result?: any;
        receipt?: any;
        metadata?: any;
        cost?: string;
        error?: string;
    }

    export interface Plugin {
        id: string;
        name: string;
        description: string;
        pricePerCall: string;
        version: string;
        owner: string;
        totalCalls: string;
        active: boolean;
    }

    export interface ValidationResult {
        valid: boolean;
        error?: string;
    }

    export interface AuthHeaders {
        'X-User-Address': string;
        'X-Signature': string;
        'X-Timestamp': string;
    }

    export class DuckGPTClient {
        constructor(options?: DuckGPTClientOptions);
        
        // Main plugin methods
        callPlugin(pluginId: number, payload: any, options?: any): Promise<PluginCallResult>;
        summarize(text: string, options?: { maxLength?: number; style?: string }): Promise<PluginCallResult>;
        generateMeme(prompt: string, options?: { template?: string; style?: string }): Promise<PluginCallResult>;
        appriseNFT(contractAddress: string, tokenId: string, options?: { chain?: string }): Promise<PluginCallResult>;
        
        // Escrow management
        prepayPlugin(pluginId: number, amount: bigint): Promise<any>;
        getEscrowBalance(pluginId: number): Promise<string>;
        
        // Plugin discovery
        listPlugins(): Promise<Plugin[]>;
        getPlugin(pluginId: number): Promise<Plugin>;
        
        // Token management
        getDuckBalance(): Promise<string>;
        approveDuck(amount: string): Promise<any>;
    }

    // Utility functions
    export function validatePayload(payload: any, pluginId: number): ValidationResult;
    export function createAuthHeaders(wallet: Wallet, userAddress: string, requestBody: any): Promise<AuthHeaders>;
    export function parseReceipt(receipt: any): any;
    export function formatError(error: any): string;
    export function retryOperation<T>(operation: () => Promise<T>, maxRetries?: number, delay?: number): Promise<T>;

    export const version: string;
    export default DuckGPTClient;
}