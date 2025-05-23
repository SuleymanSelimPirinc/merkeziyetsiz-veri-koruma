
// src/services/arweaveService.ts
import Arweave from 'arweave';

// Arlocal için varsayılan konfigürasyon
const arweaveInstance = Arweave.init({
  host: '127.0.0.1',
  port: 1984,
  protocol: 'http',
  timeout: 20000, // İsteğe bağlı: Zaman aşımı süresi
  logging: process.env.NODE_ENV === 'development', // Geliştirme modunda logları aç
});

class ArweaveService {
  private arweave: Arweave;
  private jwk: any | null = null; // Yüklenecek JWK (cüzdan anahtarı)

  constructor() {
    this.arweave = arweaveInstance;
  }

  public setJwk(walletJwk: any): void {
    if (walletJwk && typeof walletJwk === 'object') {
      this.jwk = walletJwk;
      console.log("Arweave JWK set successfully.");
    } else {
      this.jwk = null;
      console.error("Invalid JWK provided to ArweaveService.");
    }
  }

  public isWalletLoaded(): boolean {
    return this.jwk !== null;
  }

  // arlocal'a test token'ı mint etme (opsiyonel, ama genellikle ilk yüklemeler için gerekli)
  public async fundWallet(targetAddress?: string, quantity: string = '100000000000000') { // ~100 AR
    if (!targetAddress && this.jwk) {
      targetAddress = await this.arweave.wallets.jwkToAddress(this.jwk);
    }
    if (!targetAddress) {
      throw new Error("Target address not available for funding.");
    }
    // Bu endpoint arlocal'a özgüdür
    await this.arweave.api.get(`mint/${targetAddress}/${quantity}`);
console.log(`Funded ${targetAddress} with ${quantity} Winston on arlocal.`);
// Bakiyeyi kontrol etmek için birkaç saniye bekleyebiliriz.
await new Promise(resolve => setTimeout(resolve, 2000));
const balance = await this.arweave.wallets.getBalance(targetAddress);
console.log(`New balance for ${targetAddress}: ${this.arweave.ar.winstonToAr(balance)} AR`);
}


public async uploadData(
    data: string | ArrayBuffer | Uint8Array, // Genellikle JSON string'i olacak
    tags: { name: string; value: string }[] = []
): Promise<string | null> { // TX ID'yi veya null döndürür
    if (!this.jwk) {
    console.error("Arweave wallet (JWK) not loaded. Cannot upload.");
    throw new Error("Arweave wallet not loaded.");
}

try {
    console.log("Creating Arweave transaction with data:", typeof data === 'string' ? data.substring(0,100) + "..." : "Binary data");

    // Test token'ı mint etmeyi dene (eğer bakiye düşükse veya her zaman)
    // Gerçek bir uygulamada bu daha sofistike olmalı.
    // Şimdilik her yüklemeden önce fund etmeyi deneyebiliriz, arlocal için sorun olmaz.
    try {
        await this.fundWallet();
    } catch (fundError) {
        console.warn("Could not fund arlocal wallet (continuing upload attempt):", fundError);
    }

    const transaction = await this.arweave.createTransaction({ data: data }, this.jwk);

    // Etiketleri ekle
    tags.forEach(tag => transaction.addTag(tag.name, tag.value));
    transaction.addTag('App-Name', 'DecentralizedIdentityCore-DApp'); // Uygulama etiketi
    transaction.addTag('Content-Type', typeof data === 'string' ? 'application/json' : 'application/octet-stream');


    await this.arweave.transactions.sign(transaction, this.jwk);
    console.log("Arweave transaction signed.");

    const uploader = await this.arweave.transactions.getUploader(transaction);

    while (!uploader.isComplete) {
        await uploader.uploadChunk();
        console.log(`${uploader.pctComplete}% complete`);
    }

    console.log("Arweave upload complete. TX ID:", transaction.id);
    return transaction.id;

} catch (error) {
    console.error("Error uploading data to Arweave:", error);
    throw error; // Hatanın yukarı yayılmasını sağla
}
}

// Arweave'den veri çekme (sonraki adımda deşifreleme için kullanılacak)
public async getData(txId: string): Promise<string | Uint8Array> {
    try {
        console.log(`Fetching data from Arweave for TX ID: ${txId}`);
        // getData metodu veriyi string veya Uint8Array olarak döndürebilir
        // {decode: true, string: true} string olarak getirmeyi zorlar (eğer JSON ise)
        const data = await this.arweave.transactions.getData(txId, { decode: true, string: true });
        console.log("Data fetched from Arweave.");
        return data;
    } catch (error) {
        console.error(`Error fetching data from Arweave (TX: ${txId}):`, error);
        throw error;
    }
}
}

const arweaveService = new ArweaveService();
export default arweaveService;

/*Notlar:**
*   `arweaveInstance` doğrudan `arlocal`'a bağlanacak şekilde ayarlandı.
*   `setJwk` metodu, kullanıcının yüklediği anahtar dosyasının içeriğini (JSON objesi) almak için.
*   `fundWallet` metodu, `arlocal` üzerinde test token'ı mint etmek için (genellikle cüzdan boşsa ilk yüklemelerde gereklidir).
*   `uploadData` metodu, veriyi ve etiketleri alıp Arweave'e yükler.
*   `getData` metodu, TX ID ile Arweave'den veri çekmek için.*/