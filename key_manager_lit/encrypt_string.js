// key_manager_lit/encrypt_string.js
const { LIT_ABILITY } = require('@lit-protocol/constants');
const { getLitClient } = require('./lit_client');
const { getSessionSigs } = require('./auth_helper');
const { LitAccessControlConditionResource } = require('@lit-protocol/auth-helpers');

function hexToUint8Array(hexString) {
    if (hexString.length % 2 !== 0) {
        console.error("ERROR (hexToUint8Array): Invalid hexString length:", hexString);
        throw "Invalid hexString: Must be an even number of characters";
    }
    var_array = new Uint8Array(hexString.length / 2);
    for (var i = 0; i < hexString.length; i += 2) {
        var_array[i / 2] = parseInt(hexString.substring(i, i + 2), 16);
    }
    return var_array;
}

async function main() {
    // console.error("--- encrypt_string.js BAŞLADI ---"); // Başlangıç logu kalabilir
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.error("FATAL (encrypt_string.js): Missing arguments. Usage: node encrypt_string.js <aesKeyHexString> <ethAddress>");
        process.exit(1);
    }
    const aesKeyHexString = args[0];
    const ethAddress = args[1];
    const chain = 'sepolia';

    let litClient;
    try {
        litClient = await getLitClient();
        if (!litClient || !litClient.ready) {
            throw new Error("Lit Client could not be initialized or is not ready.");
        }
    } catch (e_lc) {
        console.error("FATAL (encrypt_string.js): Error during getLitClient:", e_lc.message);
        process.exit(1);
    }

    let sessionSigs;
    try {
        const accResource = new LitAccessControlConditionResource('*');
        const signingAbility = LIT_ABILITY.AccessControlConditionSigning;
        const resourceAbilityRequests = [ { resource: accResource, ability: signingAbility } ];
        sessionSigs = await getSessionSigs(litClient, chain, resourceAbilityRequests);
        if (!sessionSigs || Object.keys(sessionSigs).length === 0) {
            throw new Error("getSessionSigs returned empty or undefined.");
        }
    } catch (e_gss) {
        console.error("FATAL (encrypt_string.js): Error during getSessionSigs:", e_gss.message);
        process.exit(1);
    }

    try {
        const accessControlConditions = [
            {
                contractAddress: '', standardContractType: '', chain, method: '',
                parameters: [':userAddress'],
                returnValueTest: { comparator: '=', value: ethAddress },
            },
        ];

        const dataToEncrypt = hexToUint8Array(aesKeyHexString);

        const { ciphertext, dataToEncryptHash } = await litClient.encrypt({
            accessControlConditions,
            sessionSigs,
            chain,
            dataToEncrypt,
        });

        if (!ciphertext || !dataToEncryptHash) {
            throw new Error("Encryption result is missing ciphertext or dataToEncryptHash.");
        }

        const outputJson = JSON.stringify({
            lit_ciphertext: ciphertext,
            lit_data_hash: dataToEncryptHash,
        });
        console.log(outputJson);
        // console.error("--- encrypt_string.js BAŞARIYLA TAMAMLANDI ---"); // Başarı logu Rust tarafında zaten var
        process.exit(0);

    } catch (e_encrypt) {
        console.error("FATAL (encrypt_string.js): Error during litClient.encrypt:", e_encrypt.message);
        process.exit(1);
    }
}

main().catch(err => {
    console.error("FATAL (encrypt_string.js global catch):", err.message);
    process.exit(1);
});