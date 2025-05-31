// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20; // Güncel ve stabil bir Solidity versiyonu

contract MetadataStorage {
    struct FileMetadata {
        string fileName;
        string arweaveTxId;
        string originalFileType; // Dosyanın MIME tipini saklayalım
        uint256 timestamp; // Yükleme zaman damgası
        // Gelecekte eklenebilir: uint256 fileSize;
    }

    // Her kullanıcı adresi için bir FileMetadata dizisi
    mapping(address => FileMetadata[]) private userFiles;

    // Kullanıcının dosya sayısını tutmak için ayrı bir mapping
    mapping(address => uint256) private userFileCounts;

    event FileAdded(
        address indexed user,
        string fileName,
        string arweaveTxId,
        uint256 timestamp
    );

    /**
     * @dev Yeni bir dosya bilgisini kullanıcının listesine ekler.
     * @param _fileName Saklanacak dosyanın adı.
     * @param _arweaveTxId Dosyanın Arweave üzerindeki işlem ID'si.
     * @param _originalFileType Dosyanın orijinal MIME tipi.
     */
    function addFile(
        string memory _fileName,
        string memory _arweaveTxId,
        string memory _originalFileType
    ) public {
        require(bytes(_fileName).length > 0, "File name cannot be empty");
        require(bytes(_arweaveTxId).length > 0, "Arweave TX ID cannot be empty");
        // require(bytes(_originalFileType).length > 0, "File type cannot be empty"); // İsteğe bağlı

        userFiles[msg.sender].push(
            FileMetadata({
                fileName: _fileName,
                arweaveTxId: _arweaveTxId,
                originalFileType: _originalFileType,
                timestamp: block.timestamp
            })
        );
        userFileCounts[msg.sender]++;

        emit FileAdded(msg.sender, _fileName, _arweaveTxId, block.timestamp);
    }

    /**
     * @dev Belirli bir kullanıcının yüklediği tüm dosyaların metadata'sını döndürür.
     * @param _user Dosyaları listelenecek kullanıcının adresi.
     */
    function getFiles(address _user) public view returns (FileMetadata[] memory) {
        return userFiles[_user];
    }

    /**
     * @dev Belirli bir kullanıcının yüklediği dosya sayısını döndürür.
     * @param _user Dosya sayısı öğrenilecek kullanıcının adresi.
     */
    function getFileCount(address _user) public view returns (uint256) {
        return userFileCounts[_user];
    }
}