// src/services/contractService.ts
import { ethers, Contract } from 'ethers';
import { FileMetadata } from './fileTypes'; // Birazdan bu tipi tanımlayacağız

// MetadataStorage.json dosyasından ABI'yi import et
// Bu importun çalışması için tsconfig.json'da "resolveJsonModule": true olmalı
// ve "allowSyntheticDefaultImports": true (veya import * as ABI from ...) gerekebilir.
import ContractABI from '../contracts/MetadataStorage.json';

// Kontratınızın Sepolia'ya dağıtıldığı adresi buraya yapıştırın
const CONTRACT_ADDRESS = "0x5b7b429BEBFE55b3030AAD671D458a57FE3fb561"; // SİZİN KONTRAKT ADRESİNİZ

class ContractService {
    private getContract(signerOrProvider: ethers.Signer | ethers.providers.Provider): Contract {
        // ABI'yi ContractABI.abi'den al (eğer tüm JSON'u import ettiyseniz)
        return new ethers.Contract(CONTRACT_ADDRESS, ContractABI.abi, signerOrProvider);
    }

    // Yeni bir dosya bilgisini kontrata ekler
    public async addFileMetadata(
        signer: ethers.Signer, // İşlemi imzalamak için signer gerekli
        fileName: string,
        arweaveTxId: string,
        originalFileType: string
    ): Promise<string | null> { // Başarılı olursa işlem hash'ini döndürür
        if (!signer) {
            console.error("ContractService: Signer not provided for addFileMetadata.");
            throw new Error("Signer not available to add file metadata.");
        }
        try {
            const contract = this.getContract(signer);
            console.log(`ContractService: Calling addFile with: ${fileName}, ${arweaveTxId}, ${originalFileType}`);
            const tx = await contract.addFile(fileName, arweaveTxId, originalFileType);
            console.log("ContractService: addFile transaction sent:", tx.hash);
            await tx.wait(); // İşlemin mine edilmesini bekle
            console.log("ContractService: addFile transaction mined:", tx.hash);
            return tx.hash;
        } catch (error) {
            console.error("Error adding file metadata to contract:", error);
            throw error; // Hatanın yukarı yayılmasını sağla
        }
    }

    // Belirli bir kullanıcının dosyalarını kontrattan çeker
    public async getFilesForUser(
        provider: ethers.providers.Provider, // Sadece okuma için provider yeterli
        userAddress: string
    ): Promise<FileMetadata[]> {
        if (!provider) {
            console.error("ContractService: Provider not provided for getFilesForUser.");
            throw new Error("Provider not available to get files.");
        }
        try {
            const contract = this.getContract(provider);
            console.log(`ContractService: Calling getFiles for user: ${userAddress}`);
            const filesRaw = await contract.getFiles(userAddress);
            console.log("ContractService: Raw files from contract:", filesRaw);

            // Kontrattan dönen struct array'ini bizim istediğimiz formata map'leyelim
            const files: FileMetadata[] = filesRaw.map((file: any) => ({
                fileName: file.fileName,
                arweaveTxId: file.arweaveTxId,
                originalFileType: file.originalFileType,
                timestamp: file.timestamp.toNumber(), // BigNumber'ı number'a çevir
            }));
            return files;
        } catch (error) {
            console.error("Error fetching files from contract:", error);
            throw error;
        }
    }
}

const contractService = new ContractService();
export default contractService;