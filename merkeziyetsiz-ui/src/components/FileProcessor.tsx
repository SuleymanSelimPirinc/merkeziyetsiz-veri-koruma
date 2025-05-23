// src/components/FileProcessor.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import litService from '../services/litService';
import arweaveService from '../services/arweaveService';
import { LIT_ABILITY } from '@lit-protocol/constants';
import { LitAccessControlConditionResource } from '@lit-protocol/auth-helpers';
import { LitResourceAbilityRequest, UnifiedAccessControlConditions } from '@lit-protocol/types';

// bytesToHex fonksiyonunu component dışında tanımla
const bytesToHex = (bytes: Uint8Array): string => {
    return bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');
};

// İki Uint8Array'in eşit olup olmadığını kontrol eden yardımcı fonksiyon
const compareUint8Arrays = (a1: Uint8Array, a2: Uint8Array): boolean => {
    if (a1.length !== a2.length) return false;
    for (let i = 0; i < a1.length; i++) {
        if (a1[i] !== a2[i]) return false;
    }
    return true;
};

interface FileProcessorProps {
    signer: ethers.Signer | null;
    userAddress: string | null;
}

const FileProcessor: React.FC<FileProcessorProps> = ({ signer: propSigner, userAddress: propUserAddress }) => {
    // ... (TÜM STATE TANIMLAMALARI AYNI KALACAK)
    const [wasm, setWasm] = useState<any | null>(null);
    const [wasmMemory, setWasmMemory] = useState<WebAssembly.Memory | null>(null);
    const [isLoadingWasm, setIsLoadingWasm] = useState<boolean>(true);
    const [message, setMessage] = useState<string>('Lütfen cüzdanınızı bağlayın.');
    const [selectedFileForEncryption, setSelectedFileForEncryption] = useState<File | null>(null);
    const [originalFileContentForVerification, setOriginalFileContentForVerification] = useState<Uint8Array | null>(null);
    const [aesKeyBytes, setAesKeyBytes] = useState<Uint8Array | null>(null);
    const [litEncryptedAesKey, setLitEncryptedAesKey] = useState<{ ciphertext: string; dataToEncryptHash: string } | null>(null);
    const [arweaveJwk, setArweaveJwk] = useState<any | null>(null);
    const [arweaveTxId, setArweaveTxId] = useState<string | null>(null);
    const [txIdToDecrypt, setTxIdToDecrypt] = useState<string>('');
    const [decryptedFileUrl, setDecryptedFileUrl] = useState<string | null>(null);
    const [decryptedFileName, setDecryptedFileName] = useState<string>('decrypted_file');
    const [currentUserAddress, setCurrentUserAddress] = useState<string | null>(null);
    const [currentSigner, setCurrentSigner] = useState<ethers.Signer | null>(null);

    useEffect(() => {
        setCurrentUserAddress(propUserAddress);
    }, [propUserAddress]);

    useEffect(() => {
        setCurrentSigner(propSigner);
    }, [propSigner]);


    useEffect(() => {
        const initWasmAndLit = async () => {
            setIsLoadingWasm(true); setMessage('WASM modülü yükleniyor...');
            try {
                const moduleLoader = await import('../lib/rust-crypto/decentralized_identity_core');
                const initializedWasm = await moduleLoader.default();
                if (!initializedWasm?.generate_aes_key_wasm || !initializedWasm.memory) { throw new Error("WASM init failed."); }
                setWasm(initializedWasm); setWasmMemory(initializedWasm.memory);
                if (initializedWasm.set_panic_hook) initializedWasm.set_panic_hook();
                setMessage('WASM yüklendi.');
                if (propSigner && propUserAddress) { // propSigner ve propUserAddress kullanıldı
                    setMessage('Lit Service hazırlanıyor...'); await litService.connectAndSetSigner(propSigner);
                    setMessage('WASM ve Lit Service hazır. Arweave cüzdanınızı ve ardından dosyanızı seçebilirsiniz.');
                } else { setMessage('WASM yüklendi. Lit Service için cüzdan bağlantısı bekleniyor.'); litService.clearSigner(); }
            } catch (err) { const e = (err instanceof Error) ? err.message : String(err); setMessage(`Hata (Başlatma): ${e}`); console.error("Init Error:", e); }
            finally { setIsLoadingWasm(false); }
        };
        initWasmAndLit();
    }, [propSigner, propUserAddress]); // prop'lara bağımlı

    const handleEncryptionFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setSelectedFileForEncryption(file);
            setMessage(`Şifreleme için dosya seçildi: ${file.name}`);
            setLitEncryptedAesKey(null); setDecryptedFileUrl(null);
            setAesKeyBytes(null); setArweaveTxId(null);
            try {
                const arrayBuffer = await file.arrayBuffer();
                const content = new Uint8Array(arrayBuffer);
                setOriginalFileContentForVerification(content);
            } catch (error) { console.error("Dosya okuma hatası:", error); setMessage("Hata: Dosya okunamadı."); setOriginalFileContentForVerification(null); setSelectedFileForEncryption(null); }
        } else { setSelectedFileForEncryption(null); setOriginalFileContentForVerification(null); setMessage("Dosya seçimi iptal edildi."); }
    }, []);

    const handleArweaveJwkChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setMessage(`Arweave JWK dosyası okunuyor: ${file.name}`);
            try {
                const jwkString = await file.text();
                const jwk = JSON.parse(jwkString);
                arweaveService.setJwk(jwk); setArweaveJwk(jwk);
                setMessage(`Arweave cüzdanı yüklendi. Şimdi şifrelenecek dosyayı seçebilirsiniz.`);
            } catch (error) { console.error("Arweave JWK okuma/parse hatası:", error); setMessage("Hata: Arweave JWK okunamadı veya geçersiz JSON."); arweaveService.setJwk(null); setArweaveJwk(null); }
        }
    }, []);

    const handleGenerateAesKey = useCallback(() => {
        if (!wasm) { setMessage("WASM yüklenmedi"); return; }
        if (!currentSigner) { setMessage("Lütfen cüzdanınızı bağlayın."); return; } // currentSigner kullanıldı
        if (!selectedFileForEncryption) { setMessage("Lütfen önce bir dosya seçin."); return; }
        if (!arweaveJwk) { setMessage("Lütfen Arweave cüzdanınızı yükleyin."); return; }

        try {
            const keyBytesGenerated = wasm.generate_aes_key_wasm();
            console.log("handleGenerateAesKey: WASM'dan dönen keyBytesGenerated:", keyBytesGenerated);

            if (keyBytesGenerated instanceof Uint8Array && keyBytesGenerated.length === 32) {
                const keyBytesCopy = new Uint8Array(keyBytesGenerated);
                setAesKeyBytes(keyBytesCopy);
                setMessage(`Yeni AES Anahtarı üretildi. Şimdi Lit ile koruyun. (HEX): ${bytesToHex(keyBytesCopy)}`);
                console.log("handleGenerateAesKey: aesKeyBytes state'i ayarlandı. Değer:", keyBytesCopy);
                setLitEncryptedAesKey(null);
            } else {
                setAesKeyBytes(null);
                throw new Error(`Geçersiz anahtar formatı veya değer. Alınan: ${JSON.stringify(keyBytesGenerated)}`);
            }
        } catch (e:any) {
            setAesKeyBytes(null);
            setMessage(`AES Anahtar Üretme Hatası: ${e.message}`);
            console.error("AES Key Gen Error:", e);
        }
    }, [wasm, currentSigner, selectedFileForEncryption, arweaveJwk]); // currentSigner kullanıldı

    const handleEncryptAesKeyWithLit = useCallback(async () => {
        console.log("handleEncryptAesKeyWithLit: Fonksiyon başlatıldı.");
        console.log("  Mevcut State'ler:");
        console.log("    aesKeyBytes:", !!aesKeyBytes, aesKeyBytes ? bytesToHex(aesKeyBytes.slice(0,5)) + "..." : null);
        console.log("    currentUserAddress:", currentUserAddress);
        console.log("    currentSigner:", !!currentSigner);
        console.log("    arweaveJwk:", !!arweaveJwk);

        if (!aesKeyBytes) { setMessage("Önce AES anahtarı üretin."); console.error("LitEncryptAES: aesKeyBytes eksik"); return; }
        if (!currentUserAddress || !currentSigner) { setMessage("Kullanıcı adresi veya cüzdan (signer) bulunamadı."); console.error("LitEncryptAES: UserAddress veya Signer eksik"); return; }
        if (!arweaveJwk) { setMessage("Lütfen Arweave cüzdanınızı yükleyin."); console.error("LitEncryptAES: Arweave JWK eksik"); return; }

        setMessage("AES anahtarı Lit ile şifreleniyor... (MetaMask onayı gerekebilir)");
        try {
            console.log("LitEncryptAES: ACL oluşturuluyor...");
            const acl = litService.createAcl(currentUserAddress, 'sepolia');
            console.log("LitEncryptAES: ACL oluşturuldu:", acl);

            // resourceAbilityRequests için tipi any[] olarak bırakmıştık litService'te, burada da öyle kullanalım
            const resourceAbilityRequests: any[] = [
                { resource: new LitAccessControlConditionResource('*'), ability: LIT_ABILITY.AccessControlConditionSigning },
            ];
            console.log("LitEncryptAES: resourceAbilityRequests oluşturuldu:", resourceAbilityRequests);

            // Eğer getSessionSigs'i burada manuel çağırmak istiyorsak:
            // console.log("LitEncryptAES: getSessionSigs çağrılıyor (eğer sessionSigs null ise litService içinde çağrılacak)...");
            // await litService.getSessionSigs(resourceAbilityRequests, 'sepolia'); // Bu, sessionSigs'i set eder
            // console.log("LitEncryptAES: litService.sessionSigs (varsa):", (litService as any).sessionSigs); // Test için

            console.log("LitEncryptAES: litService.encryptWithLit çağrılıyor...");
            const result = await litService.encryptWithLit(aesKeyBytes, acl, 'sepolia');
            console.log("LitEncryptAES: litService.encryptWithLit sonucu:", result);

            if (result?.ciphertext && result.dataToEncryptHash) {
                setLitEncryptedAesKey(result);
                setMessage(`AES anahtarı Lit ile şifrelendi! Şimdi dosyayı şifreleyebilirsiniz.`);
                console.log("LitEncryptAES: Başarılı! Lit Encrypted AES Key:", result);
            } else {
                throw new Error("Lit ile şifreleme null veya geçersiz sonuç döndürdü.");
            }
        } catch (error: any) {
            setMessage(`Lit ile AES Anahtarı Şifreleme Hatası: ${error.message}`);
            console.error("LitEncryptAES Error Catch:", error);
        }
    }, [aesKeyBytes, currentUserAddress, currentSigner, arweaveJwk]); // Bağımlılıklar

    const handleEncryptAndUpload = useCallback(async () => {
        console.log("handleEncryptAndUpload: Fonksiyon başlatıldı.");
        console.log("  Mevcut State'ler:");
        console.log("    originalFileContentForVerification:", !!originalFileContentForVerification, originalFileContentForVerification?.byteLength);
        console.log("    aesKeyBytes:", !!aesKeyBytes, aesKeyBytes ? bytesToHex(aesKeyBytes.slice(0,5)) + "..." : null);
        console.log("    litEncryptedAesKey:", !!litEncryptedAesKey, litEncryptedAesKey);
        console.log("    arweaveJwk:", !!arweaveJwk);
        console.log("    selectedFileForEncryption:", !!selectedFileForEncryption, selectedFileForEncryption?.name);
        console.log("    wasm ve wasmMemory:", !!wasm, !!wasmMemory);


        if (!wasm || !wasmMemory) { setMessage("Hata: WASM modülü veya belleği hazır değil."); console.error("EncryptUpload: WASM eksik"); return; }
        if (!aesKeyBytes) { setMessage("Hata: AES anahtarı üretilmemiş."); console.error("EncryptUpload: aesKeyBytes eksik"); return; }
        if (!originalFileContentForVerification) { setMessage("Hata: Şifrelenecek dosya içeriği bulunamadı."); console.error("EncryptUpload: originalFileContentForVerification eksik"); return; }
        if (!litEncryptedAesKey) { setMessage("Hata: AES anahtarı Lit ile korunmamış."); console.error("EncryptUpload: litEncryptedAesKey eksik"); return; }
        if (!arweaveService.isWalletLoaded() || !arweaveJwk) { setMessage("Hata: Arweave cüzdanı yüklenmemiş."); console.error("EncryptUpload: Arweave JWK eksik"); return; }
        if (!selectedFileForEncryption) { setMessage("Hata: Şifrelenecek dosya seçilmemiş."); console.error("EncryptUpload: selectedFileForEncryption eksik"); return; }

        setMessage("Dosya şifreleniyor, paketleniyor ve Arweave'e yükleniyor...");
        let keyPtr = 0, plaintextPtr = 0;
        try {
            console.log("EncryptUpload: WASM belleğinde yer ayrılıyor...");
            keyPtr = wasm.wasm_alloc(aesKeyBytes.length);
            plaintextPtr = wasm.wasm_alloc(originalFileContentForVerification.length);
            if (keyPtr === 0 || plaintextPtr === 0) throw new Error("WASM belleği ayrılamadı.");
            console.log(`EncryptUpload: Yer ayrıldı: keyPtr=${keyPtr}, plaintextPtr=${plaintextPtr}`);

            new Uint8Array(wasmMemory.buffer, keyPtr, aesKeyBytes.length).set(aesKeyBytes);
            new Uint8Array(wasmMemory.buffer, plaintextPtr, originalFileContentForVerification.length).set(originalFileContentForVerification);
            console.log("EncryptUpload: Veriler WASM belleğine kopyalandı.");

            const encryptionResultWasm = wasm.encrypt_data_wasm(keyPtr, aesKeyBytes.length, plaintextPtr, originalFileContentForVerification.length);
            console.log("EncryptUpload: WASM şifreleme sonucu:", encryptionResultWasm);
            if (typeof encryptionResultWasm === 'string') throw new Error(`WASM Şifreleme Hatası: ${encryptionResultWasm}`);

            if (encryptionResultWasm?.nonce instanceof Uint8Array && encryptionResultWasm?.ciphertext instanceof Uint8Array) {
                const archiveToUpload = {
                    originalFileName: selectedFileForEncryption.name,
                    originalFileType: selectedFileForEncryption.type || 'application/octet-stream',
                    encryptedFileNonce_base64: Buffer.from(encryptionResultWasm.nonce).toString('base64'),
                    encryptedFileCiphertext_base64: Buffer.from(encryptionResultWasm.ciphertext).toString('base64'),
                    litProtectedAesKey: litEncryptedAesKey
                };

                const archiveJsonString = JSON.stringify(archiveToUpload);
                console.log("EncryptUpload: Arweave'e yüklenecek paket:", archiveJsonString.substring(0, 200) + "...");

                const tags: { name: string; value: string }[] = [
                    { name: "Content-Type", value: "application/json" },
                    { name: "App-Name", value: "LitGateway-DApp-V1"},
                    { name: "Original-File-Name", value: selectedFileForEncryption.name }
                ];
                console.log("EncryptUpload: Arweave'e yükleme başlatılıyor...");
                const txId = await arweaveService.uploadData(archiveJsonString, tags);
                console.log("EncryptUpload: Arweave uploadData sonucu TX ID:", txId);

                if (txId) { setArweaveTxId(txId); setMessage(`Paket Arweave'e yüklendi! TX ID: ${txId}`); }
                else { throw new Error("Arweave TX ID alınamadı."); }
            } else { throw new Error("WASM şifreleme sonucu hatalı.");}
        } catch(e:any){
            setMessage(`Hata (Şifreleme/Arweave): ${e.message}`);
            console.error("EncryptUpload Error Catch:", e);
        }
        finally {
            console.log("EncryptUpload: Finally bloğu - Bellek serbest bırakılıyor.");
            if(keyPtr && wasm?.wasm_dealloc && aesKeyBytes) wasm.wasm_dealloc(keyPtr, aesKeyBytes.length);
            if(plaintextPtr && wasm?.wasm_dealloc && originalFileContentForVerification) wasm.wasm_dealloc(plaintextPtr, originalFileContentForVerification.length);
            console.log("EncryptUpload: Bellek serbest bırakıldı.");
        }
    }, [wasm, wasmMemory, aesKeyBytes, originalFileContentForVerification, litEncryptedAesKey, selectedFileForEncryption, arweaveJwk]);
    const handleDecryptArchive = useCallback(async () => {
        console.log("handleDecryptArchive: Fonksiyon başlatıldı.");
        console.log("  Mevcut State'ler/Proplar:");
        console.log("    txIdToDecrypt:", txIdToDecrypt);
        console.log("    wasm:", !!wasm);
        console.log("    wasmMemory:", !!wasmMemory);
        console.log("    currentSigner:", !!currentSigner);
        console.log("    currentUserAddress:", currentUserAddress);
        // console.log("    arweaveJwk:", !!arweaveJwk); // Artık bu butonu doğrudan etkilememeli

        if (!txIdToDecrypt) { setMessage("Lütfen deşifre edilecek Arweave TX ID'sini girin."); console.error("DecryptArchive: TX ID eksik"); return; }
        if (!wasm || !wasmMemory) { setMessage("WASM modülü veya belleği yüklenmedi."); console.error("DecryptArchive: WASM eksik"); return; }
        if (!litService) { setMessage("Lit Service hazır değil."); console.error("DecryptArchive: LitService eksik"); return; }
        if (!currentSigner || !currentUserAddress) { setMessage("Cüzdan bağlı değil veya adres alınamadı."); console.error("DecryptArchive: Signer/UserAddress eksik"); return; }

        setMessage(`Arweave'den veri çekiliyor (TX: ${txIdToDecrypt})...`);
        setDecryptedFileUrl(null);

        let decAesKeyPtr = 0, wasmCipherPtr = 0, wasmNoncePtr = 0;
        let decryptedAesKeyBytesLocal: Uint8Array | null = null;
        let wasmCiphertextLocal: Uint8Array | null = null;
        let wasmNonceLocal: Uint8Array | null = null;

        try {
            console.log("DecryptArchive: Arweave'den veri çekiliyor...");
            const archiveJsonString = await arweaveService.getData(txIdToDecrypt);
            if (typeof archiveJsonString !== 'string') {
                throw new Error("Arweave'den çekilen veri string değil. Alınan: " + typeof archiveJsonString);
            }
            const archive = JSON.parse(archiveJsonString);
            console.log("DecryptArchive: Arweave'den çekilen arşiv:", archive);

            const archiveLitKey = archive.litProtectedAesKey;
            const originalFileNameFromArchive = archive.originalFileName || 'decrypted_file_from_arweave';
            setDecryptedFileName(originalFileNameFromArchive);

            const encryptedFileNonce_b64 = archive.encryptedFileNonce_base64;
            const encryptedFileCiphertext_b64 = archive.encryptedFileCiphertext_base64;

            if (!archiveLitKey || !encryptedFileNonce_b64 || !encryptedFileCiphertext_b64) {
                throw new Error("Arşivde eksik bilgi var (Lit anahtarı veya şifreli dosya/nonce).");
            }

            setMessage("Lit Protocol ile AES anahtarı çözülüyor... (MetaMask onayı gerekebilir)");
            console.log("DecryptArchive: ACL oluşturuluyor userAddress ile:", currentUserAddress);
            const acl = litService.createAcl(currentUserAddress, 'sepolia'); // currentUserAddress kullanılmalı
            console.log("DecryptArchive: ACL oluşturuldu:", acl);

            console.log("DecryptArchive: litService.decryptWithLit çağrılıyor...");
            decryptedAesKeyBytesLocal = await litService.decryptWithLit(
                archiveLitKey.ciphertext,
                archiveLitKey.dataToEncryptHash,
                acl,
                'sepolia'
            );

            if (!decryptedAesKeyBytesLocal) { throw new Error("Lit ile AES anahtarı çözülemedi."); }
            console.log("DecryptArchive: Lit ile çözülen AES Anahtarı (HEX):", bytesToHex(decryptedAesKeyBytesLocal));
            setMessage("AES anahtarı çözüldü. Dosya WASM ile deşifre ediliyor...");

            wasmCiphertextLocal = Buffer.from(encryptedFileCiphertext_b64, 'base64');
            wasmNonceLocal = Buffer.from(encryptedFileNonce_b64, 'base64');
            console.log("DecryptArchive: Şifreli dosya ve nonce base64'ten çözüldü.");

            console.log("DecryptArchive: WASM için bellek ayrılıyor...");
            decAesKeyPtr = wasm.wasm_alloc(decryptedAesKeyBytesLocal.length);
            wasmCipherPtr = wasm.wasm_alloc(wasmCiphertextLocal.length);
            wasmNoncePtr = wasm.wasm_alloc(wasmNonceLocal.length);
            if(!decAesKeyPtr || !wasmCipherPtr || !wasmNoncePtr) throw new Error("WASM belleği (deşifre) ayrılamadı.");
            console.log(`DecryptArchive: Bellek ayrıldı: decAesKeyPtr=${decAesKeyPtr}, wasmCipherPtr=${wasmCipherPtr}, wasmNoncePtr=${wasmNoncePtr}`);

            console.log("DecryptArchive: Veriler WASM belleğine kopyalanıyor...");
            new Uint8Array(wasmMemory.buffer, decAesKeyPtr, decryptedAesKeyBytesLocal.length).set(decryptedAesKeyBytesLocal);
            new Uint8Array(wasmMemory.buffer, wasmCipherPtr, wasmCiphertextLocal.length).set(wasmCiphertextLocal);
            new Uint8Array(wasmMemory.buffer, wasmNoncePtr, wasmNonceLocal.length).set(wasmNonceLocal);
            console.log("DecryptArchive: Veriler WASM belleğine kopyalandı.");

            console.log("DecryptArchive: WASM decrypt_data_wasm çağrılıyor...");
            const originalFileBytesResult = wasm.decrypt_data_wasm(
                decAesKeyPtr, decryptedAesKeyBytesLocal.length,
                wasmCipherPtr, wasmCiphertextLocal.length,
                wasmNoncePtr, wasmNonceLocal.length
            );

            if (typeof originalFileBytesResult === 'string') { throw new Error(`WASM Deşifreleme Hatası: ${originalFileBytesResult}`); }
            console.log("DecryptArchive: WASM ile deşifrelenen dosya boyutu:", originalFileBytesResult.length);

            const originalFileType = archive.originalFileType || 'application/octet-stream';
            const blob = new Blob([originalFileBytesResult], { type: originalFileType });
            const url = URL.createObjectURL(blob);
            setDecryptedFileUrl(url);

            let verificationMessage = "Dosya başarıyla deşifre edildi!";
            if (originalFileContentForVerification && selectedFileForEncryption?.name === originalFileNameFromArchive) {
                if (compareUint8Arrays(originalFileContentForVerification, originalFileBytesResult)) {
                    verificationMessage += " Orijinal dosya ile içerik doğrulandı!";
                } else {
                    verificationMessage += " DİKKAT: Orijinal dosya ile içerik UYUŞMUYOR!";
                }
            }
            setMessage(verificationMessage);
            console.log("DecryptArchive: Deşifreleme tamamlandı ve doğrulama yapıldı (eğer mümkünse).");

        } catch (error: any) {
            setMessage(`Hata (Deşifreleme Akışı): ${error.message}`);
            console.error("Error during decryption flow:", error);
        }
        finally {
            console.log("DecryptArchive: Finally bloğu - Bellek serbest bırakılıyor.");
            if(decAesKeyPtr && wasm?.wasm_dealloc && decryptedAesKeyBytesLocal) wasm.wasm_dealloc(decAesKeyPtr, decryptedAesKeyBytesLocal.length);
            if(wasmCipherPtr && wasm?.wasm_dealloc && wasmCiphertextLocal) wasm.wasm_dealloc(wasmCipherPtr, wasmCiphertextLocal.length);
            if(wasmNoncePtr && wasm?.wasm_dealloc && wasmNonceLocal) wasm.wasm_dealloc(wasmNoncePtr, wasmNonceLocal.length);
            console.log("DecryptArchive: Bellek serbest bırakıldı.");
        }
    }, [txIdToDecrypt, wasm, wasmMemory, litService, currentSigner, currentUserAddress, originalFileContentForVerification, selectedFileForEncryption]);
    // aesKeyBytes'ı bağımlılıktan çıkardık çünkü deşifrelemede Lit'ten gelen anahtar kullanılıyor.
    // encryptedFileDataWasm'a da gerek yok, Arweave'den gelen kullanılacak.
    // Butonların disabled durumlarını kontrol etmek için loglar (her render'da çalışır)
    // Bu logları sadece debug yaparken açık bırakın, sonra kaldırabilirsiniz.
    // console.log("--- FileProcessor RENDER ---");
    // console.log("  Prop Signer:", !!propSigner);
    // console.log("  Prop UserAddress:", propUserAddress);
    // console.log("  State aesKeyBytes:", !!aesKeyBytes);
    // console.log("  State arweaveJwk:", !!arweaveJwk);
    // console.log("  State selectedFileForEncryption:", !!selectedFileForEncryption);
    // console.log("  State litEncryptedAesKey:", !!litEncryptedAesKey);
    // console.log("  State originalFileContentForVerification:", !!originalFileContentForVerification);


    // Butonların disabled koşulları
    const canGenerateAesKey = !!(wasm && currentSigner && selectedFileForEncryption && arweaveJwk);
    const canEncryptAesKeyWithLit = !!(aesKeyBytes && currentUserAddress && currentSigner && arweaveJwk);
    const canEncryptAndUpload = !!(originalFileContentForVerification && aesKeyBytes && litEncryptedAesKey && arweaveJwk);
    const canDecryptArchive = !!(txIdToDecrypt && wasm && currentSigner && currentUserAddress); // arweaveJwk kontrolü kaldırıldı

    if (isLoadingWasm) {
        return (
            <div className="p-4 border border-gray-300 rounded-lg shadow-md bg-white mt-6">
                <p className="text-sm text-gray-500">WASM ve Lit Service Yükleniyor...</p>
            </div>
        );
    }

    return (
        <div className="p-4 border border-gray-300 rounded-lg shadow-md bg-white space-y-4 mt-6">
            <h3 className="text-lg font-medium text-gray-700 mb-3">İşlem Adımları</h3>

            {!currentSigner && <p className="text-sm text-orange-600">İşlemlere devam etmek için lütfen cüzdanınızı bağlayın.</p>}

            {currentSigner && (
                <div>
                    <label htmlFor="arweave-jwk-upload" className="block text-sm font-medium text-gray-700 mb-1">
                        Adım A: Arweave Cüzdan (JWK):
                    </label>
                    <input
                        id="arweave-jwk-upload"
                        type="file"
                        accept=".json"
                        onChange={handleArweaveJwkChange}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                    />
                    {arweaveJwk && <p className="text-xs text-green-600 mt-1">Arweave cüzdanı yüklendi.</p>}
                </div>
            )}

            <div>
                <label htmlFor="file-upload" className="block text-sm font-medium text-gray-700 mb-1 mt-3">Adım B: Şifrelenecek Dosya:</label>
                <input
                    id="file-upload"
                    type="file"
                    onChange={handleEncryptionFileChange}
                    disabled={!currentSigner || !arweaveJwk}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                {selectedFileForEncryption && <p className="text-xs text-gray-600 mt-1">Seçilen dosya: {selectedFileForEncryption.name}</p>}
            </div>

            <button
                onClick={handleGenerateAesKey}
                disabled={!canGenerateAesKey}
                className="w-full px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
                Adım C: Yeni AES Anahtarı Üret
            </button>
            <button
                onClick={handleEncryptAesKeyWithLit}
                disabled={!canEncryptAesKeyWithLit}
                className="w-full px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
                Adım D: AES Anahtarını Lit ile Koru
            </button>
            <button
                onClick={handleEncryptAndUpload}
                disabled={!canEncryptAndUpload}
                className="w-full px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
                Adım E: Dosyayı Şifrele & Arweave'e Yükle
            </button>

            {message && (
                <div className="mt-3 p-3 text-sm bg-gray-100 rounded break-words text-gray-800 border border-gray-200">
                    <strong>Durum:</strong> {message}
                </div>
            )}

            {arweaveTxId && (
                <div className="mt-3 p-3 text-sm bg-green-100 rounded border border-green-200">
                    <p className="font-medium text-green-700">Arweave Yükleme Başarılı!</p>
                    <p className="text-gray-700 mt-1 text-xs">TX ID:
                        <a
                            href={`http://localhost:1984/${arweaveTxId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-1 text-blue-600 hover:underline break-all"
                        >
                            {arweaveTxId}
                        </a>
                    </p>
                </div>
            )}

            {/* Deşifreleme Alanı */}
            {currentSigner && !isLoadingWasm && ( // Cüzdan bağlıysa ve yükleme bitmişse göster
                <div className="mt-6 pt-4 border-t border-gray-300">
                    <h4 className="text-md font-semibold mb-2 text-gray-700">Adım F: Dosyayı Deşifrele</h4>
                    <div>
                        <label htmlFor="txid-input" className="block text-sm font-medium text-gray-700 mb-1">Arweave TX ID:</label>
                        <input
                            id="txid-input" type="text" value={txIdToDecrypt}
                            onChange={(e) => { setTxIdToDecrypt(e.target.value); setDecryptedFileUrl(null); }}
                            placeholder="Arweave İşlem ID'sini buraya yapıştırın"
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-black placeholder-gray-500"  />
                    </div>
                    <button
                        onClick={handleDecryptArchive}
                        disabled={!canDecryptArchive}
                        className="w-full mt-3 px-3 py-2 text-sm font-medium text-white bg-teal-600 rounded-md hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
                    >
                        Deşifrele ve İndir
                    </button>
                </div>
            )}

            {decryptedFileUrl && (
                <div className="mt-3 p-3 text-sm bg-blue-100 rounded border border-blue-200">
                    <a
                        href={decryptedFileUrl}
                        download={decryptedFileName}
                        onClick={() => setTimeout(() => { if(decryptedFileUrl) URL.revokeObjectURL(decryptedFileUrl); setDecryptedFileUrl(null); }, 100)}
                        className="font-medium text-blue-700 hover:text-blue-800"
                    >
                        Deşifrelenmiş Dosyayı İndir ({decryptedFileName})
                    </a>
                </div>
            )}
        </div>
    );
};
export default FileProcessor;