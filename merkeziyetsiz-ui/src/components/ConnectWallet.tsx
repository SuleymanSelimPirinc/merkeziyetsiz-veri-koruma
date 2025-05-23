// src/components/ConnectWallet.tsx
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { ethers } from 'ethers';
import Web3Modal from 'web3modal';

const providerOptions = {
    /* WalletConnect vb. için opsiyonlar buraya eklenebilir */
};

let web3ModalInstance: Web3Modal | null = null;
if (typeof window !== 'undefined') {
    web3ModalInstance = new Web3Modal({
        network: "sepolia",
        cacheProvider: true, // Kullanıcının seçimini hatırla
        providerOptions,
    });
}

interface ConnectWalletProps {
    onSignerChange: (signer: ethers.Signer | null, address: string | null) => void;
}

const ConnectWallet: React.FC<ConnectWalletProps> = ({ onSignerChange }) => {
    const providerRef = useRef<ethers.providers.Web3Provider | null>(null);
    const [localSigner, setLocalSigner] = useState<ethers.Signer | null>(null);
    const [localAccount, setLocalAccount] = useState<string | null>(null);
    const [network, setNetwork] = useState<ethers.providers.Network | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const providerInstanceRef = useRef<any>(null); // EIP-1193 provider instance

    const disconnectWallet = useCallback(async () => {
        console.log("disconnectWallet çağrıldı");
        setIsLoading(true);
        setError(null);

        if (providerInstanceRef.current) {
            providerInstanceRef.current.removeAllListeners?.("accountsChanged");
            providerInstanceRef.current.removeAllListeners?.("chainChanged");
            providerInstanceRef.current.removeAllListeners?.("disconnect");
            console.log("Event listener'lar kaldırıldı (disconnectWallet).");
        }

        if (web3ModalInstance) {
            web3ModalInstance.clearCachedProvider();
        }

        const currentEthersProvider = providerRef.current;
        if (currentEthersProvider?.provider && typeof (currentEthersProvider.provider as any).disconnect === 'function') {
            try {
                await (currentEthersProvider.provider as any).disconnect();
            } catch (e) { console.error("Error during provider.disconnect():", e); }
        }

        providerRef.current = null;
        providerInstanceRef.current = null; // Bunu da temizle
        setLocalSigner(null);
        setLocalAccount(null);
        setNetwork(null);
        onSignerChange(null, null);
        setIsLoading(false);
    }, [onSignerChange]);


    const connectWallet = useCallback(async () => {
        if (!web3ModalInstance) { setError("Web3Modal not initialized."); return; }
        // Eğer zaten bağlıysa ve bir provider varsa, tekrar bağlanma (döngüyü önlemek için)
        // Bu kontrol çok kritik değil çünkü useEffect'teki localAccount kontrolü de var.
        // if (providerRef.current && localAccount) { return; }

        setIsLoading(true);
        setError(null);

        try {
            const instance = await web3ModalInstance.connect();
            providerInstanceRef.current = instance; // Store the raw provider instance

            const web3Provider = new ethers.providers.Web3Provider(instance, "any"); // "any" for network changes
            providerRef.current = web3Provider;

            const web3Signer = web3Provider.getSigner();
            const userAccount = await web3Signer.getAddress();
            const networkInfo = await web3Provider.getNetwork();

            setLocalSigner(web3Signer);
            setLocalAccount(userAccount);
            setNetwork(networkInfo);
            onSignerChange(web3Signer, userAccount);

            // Önceki listener'ları temizle, sonra yenilerini ekle
            instance.removeAllListeners?.("accountsChanged");
            instance.on("accountsChanged", async (accounts: string[]) => {
                console.log("CW: accountsChanged ->", accounts);
                if (accounts.length > 0) {
                    // Provider hala aynı olmalı, sadece signer ve account güncellenir
                    const newSigner = web3Provider.getSigner(); // veya providerRef.current!.getSigner();
                    setLocalSigner(newSigner);
                    setLocalAccount(accounts[0]);
                    onSignerChange(newSigner, accounts[0]);
                } else {
                    disconnectWallet();
                }
            });

            instance.removeAllListeners?.("chainChanged");
            instance.on("chainChanged", async (_chainId: string) => {
                console.log("CW: chainChanged ->", _chainId);
                // Web3Modal genellikle chain değişikliğinde yeni bir 'connect' gerektirmez, provider güncellenir.
                // Sadece state'leri ve onSignerChange'i çağıralım.
                // Yeniden instance almak yerine mevcut provider üzerinden güncelleyelim.
                if (providerRef.current) {
                    const newSigner = providerRef.current.getSigner();
                    const newAddress = await newSigner.getAddress();
                    const newNetwork = await providerRef.current.getNetwork();

                    setLocalSigner(newSigner);
                    setLocalAccount(newAddress);
                    setNetwork(newNetwork);
                    onSignerChange(newSigner, newAddress);
                } else {
                    // Bu durum olmamalı ama olursa yeniden bağlanmayı dene
                    connectWallet();
                }
            });

            instance.removeAllListeners?.("disconnect");
            instance.on("disconnect", (error: { code: number; message: string }) => {
                console.log("CW: disconnected event", error);
                disconnectWallet();
            });

        } catch (err: any) {
            console.error("Error connecting wallet:", err);
            setError(err.message || "Cüzdan bağlantısı başarısız.");
            if (web3ModalInstance) web3ModalInstance.clearCachedProvider();
            onSignerChange(null, null);
        }
        finally { setIsLoading(false); }
    }, [onSignerChange, disconnectWallet]);


    useEffect(() => {
        if (web3ModalInstance && web3ModalInstance.cachedProvider && !localAccount && !isLoading) {
            console.log("ConnectWallet useEffect: Cached provider var & not connected & not loading, connecting...");
            connectWallet();
        }
    }, [connectWallet, localAccount, isLoading]);

    useEffect(() => {
        const pInstance = providerInstanceRef.current;
        return () => {
            if (pInstance) {
                console.log("ConnectWallet unmounting: Removing listeners from provider instance.");
                pInstance.removeAllListeners?.("accountsChanged");
                pInstance.removeAllListeners?.("chainChanged");
                pInstance.removeAllListeners?.("disconnect");
            }
        };
    }, []);

    // JSX KISMI (Yorum kaldırıldı)
    return (
        <div className="p-4 border border-gray-300 rounded-lg shadow-md bg-white">
            <h3 className="text-lg font-medium mb-3 text-gray-700">Cüzdan Durumu</h3>
            {error && <p className="text-sm text-red-600 bg-red-100 p-2 rounded mb-2">Hata: {error}</p>}
            {isLoading && <p className="text-sm text-blue-600">İşleniyor...</p>}

            {localAccount && localSigner ? (
                <div className="space-y-1">
                    <p className="text-sm"><strong>Hesap:</strong> <span className="font-mono text-xs break-all">{localAccount}</span></p>
                    <p className="text-sm"><strong>Ağ:</strong> {network?.name} (ID: {network?.chainId})</p>
                    {network?.chainId !== 11155111 &&
                        <p className="text-xs text-yellow-600 bg-yellow-100 p-1 rounded">Lütfen Sepolia test ağına geçiniz.</p>
                    }
                    <button
                        onClick={disconnectWallet}
                        disabled={isLoading}
                        className="mt-2 w-full px-3 py-1.5 text-sm bg-red-500 text-white rounded-md hover:bg-red-600 disabled:opacity-50"
                    >
                        Bağlantıyı Kes
                    </button>
                </div>
            ) : (
                <button
                    onClick={connectWallet}
                    disabled={isLoading}
                    className="w-full px-3 py-1.5 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
                >
                    {isLoading ? "Bağlanıyor..." : "Cüzdanı Bağla"}
                </button>
            )}
        </div>
    );
};
export default ConnectWallet;