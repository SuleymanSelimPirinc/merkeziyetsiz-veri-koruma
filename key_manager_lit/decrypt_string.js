// key_manager_lit/decrypt_string.js
const { LIT_ABILITY } = require('@lit-protocol/constants');
const { getLitClient } = require('./lit_client');
const { getSessionSigs } = require('./auth_helper');
const { LitAccessControlConditionResource } = require('@lit-protocol/auth-helpers');
const { uint8arrayToHex } = require('@lit-protocol/uint8arrays');

async function main() {
    // console.error(`--- decrypt_string.js BAŞLADI ---`);
    const args = process.argv.slice(2);
    if (args.length < 3) {
        console.error("FATAL (decrypt_string.js): Missing arguments. Usage: node decrypt_string.js <ciphertext> <dataToEncryptHash> <ethAddress>");
        process.exit(1);
    }
    const ciphertext = args[0];
    const dataToEncryptHash = args[1];
    const ethAddress = args[2];
    const chain = 'sepolia';

    let litClient;
    try {
        litClient = await getLitClient();
        if (!litClient || !litClient.ready) {
            throw new Error("Lit Client could not be initialized or is not ready.");
        }
    } catch (e_lc) {
        console.error("FATAL (decrypt_string.js): Error during getLitClient:", e_lc.message);
        process.exit(1);
    }

    let sessionSigs;
    try {
        const accResource = new LitAccessControlConditionResource('*');
        const decryptionAbility = LIT_ABILITY.AccessControlConditionDecryption;
        const resourceAbilityRequests = [ { resource: accResource, ability: decryptionAbility } ];

        sessionSigs = await getSessionSigs(litClient, chain, resourceAbilityRequests);
        if (!sessionSigs || Object.keys(sessionSigs).length === 0) {
            throw new Error("getSessionSigs returned empty or undefined.");
        }
    } catch (e_gss) {
        console.error("FATAL (decrypt_string.js): Error during getSessionSigs:", e_gss.message);
        process.exit(1);
    }

    try {
        const accessControlConditions = [
            {
                contractAddress: '', standardContractType: '', chain: chain,
                method: '', parameters: [':userAddress'],
                returnValueTest: { comparator: '=', value: ethAddress },
            },
        ];

        const decryptionResult = await litClient.decrypt({
            accessControlConditions,
            sessionSigs,
            chain,
            ciphertext,
            dataToEncryptHash
        });

        let decryptedDataToProcess;
        if (decryptionResult && decryptionResult.decryptedData instanceof Uint8Array) {
            decryptedDataToProcess = decryptionResult.decryptedData;
        } else if (decryptionResult instanceof Uint8Array) {
            decryptedDataToProcess = decryptionResult;
        } else {
            console.error("ERROR (decrypt_string.js): Unexpected structure from litClient.decrypt. decryptionResult:", JSON.stringify(decryptionResult, null, 2));
            throw new Error("Decryption result does not contain the expected Uint8Array.");
        }

        if (!decryptedDataToProcess || decryptedDataToProcess.length === 0) {
            throw new Error("Decrypted data (Uint8Array) is empty or undefined.");
        }

        const decryptedStringHex = Buffer.from(decryptedDataToProcess).toString('hex');

        console.log(decryptedStringHex.trim());
        // console.error("--- decrypt_string.js BAŞARIYLA TAMAMLANDI ---");
        process.exit(0);

    } catch (e_decrypt) {
        console.error("FATAL (decrypt_string.js): Error during litClient.decrypt:", e_decrypt.message);
        process.exit(1);
    }
}

main().catch(err => {
    console.error("FATAL (decrypt_string.js global catch):", err.message);
    process.exit(1);
});