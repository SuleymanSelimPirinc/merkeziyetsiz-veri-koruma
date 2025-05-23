// arweave_uploader/upload.js
const Arweave = require('arweave');
const fs = require('fs').promises;
const path = require('path');

async function main() {
    const payloadFilePath = process.argv[2];
    const keyfilePath = process.argv[3];

    if (!payloadFilePath || !keyfilePath) {
        console.error("Hata: JSON payload DOSYA YOLU ve anahtar dosyası yolu argüman olarak sağlanmalıdır.");
        process.exit(1);
    }

    try {
        const arweave = Arweave.init({
            host: '127.0.0.1',
            port: 1984,
            protocol: 'http',
            timeout: 20000,
            logging: false,
        });
        // console.error("Arweave API config:", JSON.stringify(arweave.api.config, null, 2));

        if (arweave.api.config.host === '127.0.0.1' && arweave.api.config.port === 1984) {
            try {
                const keyfileFullPathResolvedMint = path.resolve(keyfilePath);
                const keyfileContentMint = await fs.readFile(keyfileFullPathResolvedMint, 'utf-8');
                const tempWallet = JSON.parse(keyfileContentMint);
                const walletAddress = await arweave.wallets.jwkToAddress(tempWallet);

                // console.error(`Arlocal: Cüzdan adresi: ${walletAddress}`);
                // const balanceBeforeWinston = await arweave.wallets.getBalance(walletAddress);
                // console.error(`Arlocal: Mint öncesi bakiye: ${arweave.ar.winstonToAr(balanceBeforeWinston)} AR`);
                // Mint etme işlemini her seferinde yapmak yerine, bakiye düşükse mint etmeyi düşünebilirsiniz
                // Şimdilik her çalıştığında mint etmeye devam etsin, arlocal için sorun olmaz.
                const mintAmountWinston = arweave.ar.arToWinston('100');
                await arweave.api.get(`mint/${walletAddress}/${mintAmountWinston}`);
                // console.error("Arlocal: Mint API çağrısı yapıldı.");
                // await new Promise(resolve => setTimeout(resolve, 500));
                // const balanceWinston = await arweave.wallets.getBalance(walletAddress);
                // console.error(`Arlocal: Mint sonrası bakiye: ${arweave.ar.winstonToAr(balanceWinston)} AR`);
            } catch (mintError) {
                console.warn("UYARI (upload.js): Arlocal mint etme denemesinde hata (yoksayılıyor):", mintError.message);
            }
        }

        const payloadFileFullPath = path.resolve(payloadFilePath);
        const jsonPayloadString = await fs.readFile(payloadFileFullPath, 'utf-8');
        const keyfileFullPathResolvedTransaction = path.resolve(keyfilePath);
        const key = JSON.parse(await fs.readFile(keyfileFullPathResolvedTransaction, 'utf-8'));

        let transaction = await arweave.createTransaction({ data: jsonPayloadString }, key);
        transaction.addTag('Content-Type', 'application/json');
        transaction.addTag('App-Name', 'DecentralizedIdentityCore');
        await arweave.transactions.sign(transaction, key);

        const uploader = await arweave.transactions.getUploader(transaction);
        while (!uploader.isComplete) {
            await uploader.uploadChunk();
            // console.error(`${uploader.pctComplete}% tamamlandı`); // Bu çok fazla log üretebilir
        }

        console.log(transaction.id);
        console.error("--- upload.js BAŞARIYLA TAMAMLANDI ---");
        process.exit(0);

    } catch (error) {
        console.error("KRİTİK HATA (upload.js):", error.message || error);
        process.exit(1);
    }
}

main();