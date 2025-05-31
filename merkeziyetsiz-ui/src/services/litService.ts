// src/services/litService.ts
import { LitNodeClient } from '@lit-protocol/lit-node-client';
import {
    // AuthSig, // Şimdilik bunu import etmeyelim, sorun çıkarıyor olabilir
    SessionSigs,
    UnifiedAccessControlConditions,
    Chain as LitChainType,
    LitResourceAbilityRequest,
} from '@lit-protocol/types'; // Diğer tiplerin burada olduğunu varsayıyoruz
import {
    createSiweMessageWithRecaps,
    LitAccessControlConditionResource,
} from '@lit-protocol/auth-helpers';
import { LIT_ABILITY, LIT_NETWORK } from '@lit-protocol/constants';
import { ethers } from 'ethers';

// Kendi basit AuthSig arayüzümüz (eski Node.js kodundaki yapıya benzer)
interface MySimpleAuthSig {
    sig: string;
    derivedVia: string;
    signedMessage: string;
    address: string;
}

const clientConstructorParams = {
    litNetwork: LIT_NETWORK.DatilTest, // VEYA 'datil-test'
    debug: process.env.NODE_ENV === 'development',
};
const litNodeClientInstance = new LitNodeClient(clientConstructorParams);

// authNeededCallback'e SDK tarafından geçirilen parametrelerin tipi
// Eski kodunuzdaki paramsForCallback'e benzetelim
interface CallbackParams {
    uri: string;
    expiration: string;
    resourceAbilityRequests?: LitResourceAbilityRequest[]; // Eski kodda bu vardı
    resources?: LitResourceAbilityRequest[]; // Bazen bu da olabilir
    chain?: LitChainType; // Opsiyonel olabilir
    nonce?: string; // Opsiyonel olabilir
    // Diğer olası SDK parametreleri
    [key: string]: any;
}

class LitService {
    private client: LitNodeClient;
    private sessionSigs: SessionSigs | null = null;
    private connectedSigner: ethers.Signer | null = null;
    private connectedAddress: string | null = null;

    constructor() { this.client = litNodeClientInstance; }

    public async connectAndSetSigner(signer: ethers.Signer): Promise<void> {
        if (!this.client.ready) {
            try { await this.client.connect(); }
            catch (e) { console.error("Lit connect error", e); throw e; }
        }
        this.connectedSigner = signer;
        this.connectedAddress = await signer.getAddress();
        this.sessionSigs = null;
    }

    public clearSigner(): void { this.connectedSigner = null; this.connectedAddress = null; this.sessionSigs = null; }

    public async getSessionSigs(
        resourceAbilityRequestsParam: LitResourceAbilityRequest[],
        chainParam: LitChainType = 'sepolia'
    ): Promise<SessionSigs> {
        if (!this.client.ready || !this.connectedSigner || !this.connectedAddress) { throw new Error("Client or signer not ready"); }

        // authNeededCallback'in dönüş tipini Promise<MySimpleAuthSig> yapalım
        const authNeededCallback = async (params: CallbackParams): Promise<MySimpleAuthSig> => {
            if (!this.connectedSigner || !this.connectedAddress) { throw new Error("Signer unavailable"); }

            const uri = params.uri;
            const expiration = params.expiration;
            const resourcesToSign = params.resourceAbilityRequests || params.resources || [];

            if (typeof uri !== 'string' || typeof expiration !== 'string') {
                throw new Error("AuthCallback params URI or Expiration are missing or not a string.");
            }

            const nonce = params.nonce || await this.client.getLatestBlockhash();

            const siweMessageToSign = await createSiweMessageWithRecaps({
                uri, expiration, resources: resourcesToSign,
                walletAddress: this.connectedAddress, nonce, litNodeClient: this.client,
                chainId: await this.connectedSigner.getChainId(),
            });
            const signature = await this.connectedSigner.signMessage(siweMessageToSign);

            const authSigResult: MySimpleAuthSig = {
                sig: signature,
                derivedVia: "web3.eth.personal.sign", // Eski kodunuzda generateAuthSig bunu üretiyordu
                signedMessage: siweMessageToSign,
                address: this.connectedAddress
            };
            return authSigResult; // Kendi MySimpleAuthSig tipimize uygun obje döndürülüyor
        };

        // getSessionSigs'e options objesi geçirelim
        // authNeededCallback için 'as any' kullanarak tip uyuşmazlığını şimdilik bypass edelim
        const options = {
            chain: chainParam,
            resourceAbilityRequests: resourceAbilityRequestsParam,
            authNeededCallback: authNeededCallback as any,
        };

        this.sessionSigs = await this.client.getSessionSigs(options);
        return this.sessionSigs;
    }

    public createAcl(ethAddressToAuth: string, chainParam: LitChainType = 'sepolia'): any[] { // Dönüş tipini any[] yaptık
        const acl: any[] = [{
            conditionType: 'evmBasic', contractAddress: '', standardContractType: '',
            chain: chainParam, method: '', parameters: [':userAddress'],
            returnValueTest: { comparator: '=', value: ethAddressToAuth }
        }];
        return acl;
    }

    public async encryptWithLit(
        dataToEncrypt: Uint8Array,
        accessControlConditionsIn: any[],
        chainParam: LitChainType = 'sepolia'
    ): Promise<{ ciphertext: string; dataToEncryptHash: string }> {
        if (!this.client.ready || !this.sessionSigs) {
            const rar: LitResourceAbilityRequest[] =
                [{ resource: new LitAccessControlConditionResource('*') as any, ability: LIT_ABILITY.AccessControlConditionSigning as any }];
            this.sessionSigs = null;
            await this.getSessionSigs(rar, chainParam);
        }
        if (!this.sessionSigs) throw new Error("SessionSigs not available for encryption.");

        return this.client.encrypt({
            sessionSigs: this.sessionSigs,
            chain: chainParam,
            accessControlConditions: accessControlConditionsIn,
            dataToEncrypt: dataToEncrypt,
        } as any);
    }

    public async decryptWithLit(
        ciphertext: string, dataToEncryptHash: string, accessControlConditionsIn: any[], // Parametre tipini any[] yaptık
        chainParam: LitChainType = 'sepolia'
    ): Promise<Uint8Array> {
        if (!this.client.ready || !this.sessionSigs) {
            const rar: LitResourceAbilityRequest[] =
                [{ resource: new LitAccessControlConditionResource('*') as any, ability: LIT_ABILITY.AccessControlConditionDecryption as any }];
            this.sessionSigs = null;
            await this.getSessionSigs(rar, chainParam);
        }
        if (!this.sessionSigs) throw new Error("SessionSigs not available for decryption.");

        const decryptedData = await this.client.decrypt({
            sessionSigs: this.sessionSigs,
            chain: chainParam,
            accessControlConditions: accessControlConditionsIn,
            ciphertext: ciphertext,
            dataToEncryptHash: dataToEncryptHash,
        } as any);

        if (decryptedData instanceof Uint8Array) return decryptedData;
        if (typeof decryptedData === 'object' && decryptedData !== null && (decryptedData as any).decryptedData instanceof Uint8Array) {
            return (decryptedData as any).decryptedData;
        }
        throw new Error("Decryption did not return Uint8Array as expected.");
    }
}

const litService = new LitService();
export default litService;