// key_manager_lit/auth_helper.js
const ethers = require('ethers');
require('dotenv').config();
const { createSiweMessageWithRecaps, generateAuthSig } = require('@lit-protocol/auth-helpers');
const { LIT_ABILITY } = require('@lit-protocol/constants');
// LitAccessControlConditionResource burada doğrudan kullanılmıyor, encrypt/decrypt betiklerinde import ediliyor.

const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "https://sepolia.drpc.org";

async function getSessionSigs(litNodeClient, chain, resourceAbilityRequestsArray) {
    const privateKey = process.env.TEST_ETH_PRIVATE_KEY;
    if (!privateKey) {
        console.error("FATAL (auth_helper.js): TEST_ETH_PRIVATE_KEY environment variable not found!");
        process.exit(1);
    }

    let provider;
    try {
        provider = new ethers.providers.JsonRpcProvider(SEPOLIA_RPC_URL);
    } catch (e) {
        console.error("FATAL (auth_helper.js): Failed to create ethers.JsonRpcProvider:", e.message);
        process.exit(1);
    }

    let wallet;
    try {
        wallet = new ethers.Wallet(privateKey.trim(), provider);
    } catch (e) {
        console.error("FATAL (auth_helper.js): Failed to create ethers.Wallet:", e.message);
        process.exit(1);
    }

    const walletAddress = await wallet.getAddress();

    const authNeededCallback = async (paramsForCallback) => {
        if (!paramsForCallback.uri || !paramsForCallback.expiration || !paramsForCallback.resourceAbilityRequests) {
            console.error("ERROR (auth_helper.js): authNeededCallback called with missing parameters.");
            throw new Error("authNeededCallback called with missing parameters");
        }

        let nonce;
        try {
            nonce = await litNodeClient.getLatestBlockhash();
            if (!nonce) throw new Error("getLatestBlockhash returned empty or undefined.");
        } catch (e) {
            console.error("ERROR (auth_helper.js): Failed to get latest blockhash from LitNode:", e.message);
            throw e;
        }

        const network = await wallet.provider.getNetwork();
        const currentChainId = network.chainId;

        const siweMessagePayload = {
            uri: paramsForCallback.uri,
            expiration: paramsForCallback.expiration,
            walletAddress: walletAddress,
            nonce: nonce,
            chainId: currentChainId,
            resources: resourceAbilityRequestsArray,
            litNodeClient: litNodeClient,
            domain: 'localhost',
            statement: 'Lit Protocol Session Signature Request', // Daha genel ve temiz bir ifade
            version: '1'
        };

        const toSign = await createSiweMessageWithRecaps(siweMessagePayload);
        const authSig = await generateAuthSig({ signer: wallet, toSign: toSign });
        return authSig;
    };

    try {
        const sessionSigs = await litNodeClient.getSessionSigs({
            chain: chain,
            resourceAbilityRequests: resourceAbilityRequestsArray,
            authNeededCallback: authNeededCallback,
        });
        console.error("🔑 SessionSigs successfully generated.");
        return sessionSigs;
    } catch (e) {
        console.error("ERROR (auth_helper.js): Failed to get session sigs:", e.message);
        // console.error("   Full Error (getSessionSigs):", JSON.stringify(e, Object.getOwnPropertyNames(e), 2)); // Gerekirse açılır
        throw e;
    }
}

module.exports = { getSessionSigs };