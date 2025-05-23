// src/app/page.tsx
"use client"; // Client component yapmak gerekebilir useState için

import { useState } from 'react';
import { ethers } from 'ethers'; // ethers.Signer tipi için
import ConnectWallet from '@/components/ConnectWallet';
import FileProcessor from '@/components/FileProcessor';

export default function HomePage() {
    const [signer, setSigner] = useState<ethers.Signer | null>(null);
    const [userAddress, setUserAddress] = useState<string | null>(null);

    const handleSignerChange = (
        newSigner: ethers.Signer | null,
        newAddress: string | null
    ) => {
        console.log("HomePage: Signer değişti ->", newAddress);
        setSigner(newSigner);
        setUserAddress(newAddress);
    };

    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-100">
            <div className="w-full max-w-lg space-y-6"> {/* max-w-md'den max-w-lg'ye genişletildi */}
                <header className="text-center">
                    <h1 className="text-3xl font-bold text-gray-800">
                        Merkeziyetsiz Veri Koruma Sistemi
                    </h1>
                    <p className="text-md text-gray-600 mt-2">
                        Dosyalarınızı güvenle şifreleyin ve yönetin.
                    </p>
                </header>

                <ConnectWallet onSignerChange={handleSignerChange} />

                {/* FileProcessor'a signer ve userAddress'i prop olarak geçir */}
                {/* isLoadingWasm durumuna göre FileProcessor'u render etmeyebiliriz ama şimdilik her zaman render edilecek */}
                {/* Kullanıcı cüzdanını bağladıktan sonra FileProcessor aktif olacak şekilde UI düzenlenebilir */}
                <FileProcessor signer={signer} userAddress={userAddress} />

            </div>
        </main>
    );
}