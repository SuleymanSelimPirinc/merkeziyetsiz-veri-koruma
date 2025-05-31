// src/services/fileTypes.ts
export interface FileMetadata {
    fileName: string;
    arweaveTxId: string;
    originalFileType: string;
    timestamp: number; // Solidity uint256'yı ethers.js BigNumber olarak döndürür, biz number'a çevireceğiz
}