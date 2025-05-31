// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol"; // Test yardımcılarını import et
import {MetadataStorage} from "../src/MetadataStorage.sol"; // Kendi MetadataStorage kontratımızı import et

contract MetadataStorageTest is Test {
    MetadataStorage public metadataStorage; // Test edilecek kontratın bir örneği

    // Testler için kullanılacak sahte kullanıcı adresleri
    address user1 = vm.addr(1); // Foundry'nin vm.addr() ile deterministik adresler üretelim
    address user2 = vm.addr(2);

    // Her bir test fonksiyonu çalıştırılmadan önce bu fonksiyon otomatik olarak çağrılır.
    function setUp() public {
        // Yeni bir MetadataStorage kontratı oluşturup deploy et
        metadataStorage = new MetadataStorage();
    }

    // Bir dosya ekleyip doğru şekilde alınıp alınamadığını test et
    function test_AddAndGetFile() public {
        string memory fileName1 = "testFile1.txt";
        string memory arweaveTxId1 = "txId123";
        string memory fileType1 = "text/plain";
        uint256 initialTimestamp = block.timestamp; // Zaman damgasını al

        // user1 olarak işlem yap (vm.startPrank ile msg.sender'ı user1 olarak ayarla)
        vm.startPrank(user1);
        metadataStorage.addFile(fileName1, arweaveTxId1, fileType1);
        vm.stopPrank(); // Prank'i bitir, msg.sender normale dönsün

        // user1 için dosyaları al
        MetadataStorage.FileMetadata[] memory filesUser1 = metadataStorage.getFiles(user1);

        // Kontroller
        assertEq(filesUser1.length, 1, "User1 should have 1 file");
        assertEq(filesUser1[0].fileName, fileName1, "File name mismatch for user1");
        assertEq(filesUser1[0].arweaveTxId, arweaveTxId1, "Arweave TX ID mismatch for user1");
        assertEq(filesUser1[0].originalFileType, fileType1, "File type mismatch for user1");
        assertTrue(filesUser1[0].timestamp >= initialTimestamp, "Timestamp should be correctly set for user1");

        // user1 için dosya sayısını kontrol et
        assertEq(metadataStorage.getFileCount(user1), 1, "File count for user1 should be 1");

        // user2 için dosya olmadığını kontrol et
        MetadataStorage.FileMetadata[] memory filesUser2 = metadataStorage.getFiles(user2);
        assertEq(filesUser2.length, 0, "User2 should have 0 files");
        assertEq(metadataStorage.getFileCount(user2), 0, "File count for user2 should be 0");
    }

    // Birden fazla dosya ekleyip doğru şekilde listelendiğini test et
    function test_AddMultipleFilesForSameUser() public {
        vm.startPrank(user1); // user1 olarak işlem yap
        metadataStorage.addFile("fileA.jpg", "txA", "image/jpeg");
        // vm.warp(block.timestamp + 1); // Eğer farklı timestamp'ler kesinlikle gerekliyse
        metadataStorage.addFile("fileB.pdf", "txB", "application/pdf");
        vm.stopPrank();

        MetadataStorage.FileMetadata[] memory files = metadataStorage.getFiles(user1);
        assertEq(files.length, 2, "User1 should have 2 files after adding multiple");
        assertEq(metadataStorage.getFileCount(user1), 2, "File count for user1 should be 2");

        // Sıralamanın eklendiği gibi olduğunu varsayıyoruz
        assertEq(files[0].fileName, "fileA.jpg");
        assertEq(files[1].fileName, "fileB.pdf");
    }

    // Farklı kullanıcıların kendi dosyalarını doğru şekilde alıp alamadığını test et
    function test_FilesAreUserSpecific() public {
        // User1 dosya ekler
        vm.startPrank(user1);
        metadataStorage.addFile("user1_file.doc", "txUser1", "application/msword");
        vm.stopPrank();

        // User2 dosya ekler
        vm.startPrank(user2);
        metadataStorage.addFile("user2_data.zip", "txUser2", "application/zip");
        vm.stopPrank();

        // User1'in dosyalarını kontrol et
        MetadataStorage.FileMetadata[] memory filesUser1 = metadataStorage.getFiles(user1);
        assertEq(filesUser1.length, 1, "User1 should still have 1 file");
        assertEq(filesUser1[0].fileName, "user1_file.doc");
        assertEq(metadataStorage.getFileCount(user1), 1);


        // User2'nin dosyalarını kontrol et
        MetadataStorage.FileMetadata[] memory filesUser2 = metadataStorage.getFiles(user2);
        assertEq(filesUser2.length, 1, "User2 should have 1 file");
        assertEq(filesUser2[0].fileName, "user2_data.zip");
        assertEq(metadataStorage.getFileCount(user2), 1);
    }

    // Boş dosya adıyla dosya eklemeye çalışıldığında revert olmasını test et
    function test_RevertIf_AddFileWithEmptyName() public {
        vm.startPrank(user1);
        // `require` içindeki hata mesajının tam olarak eşleşmesi gerekir.
        // Kontratınızdaki hata mesajı: "File name cannot be empty"
        vm.expectRevert(bytes("File name cannot be empty"));
        metadataStorage.addFile("", "txIdValid", "text/plain");
        // vm.stopPrank(); // Revert sonrası bu satıra ulaşılmaz, isteğe bağlı
    }

    // Boş Arweave TX ID ile dosya eklemeye çalışıldığında revert olmasını test et
    function test_RevertIf_AddFileWithEmptyTxId() public {
        vm.startPrank(user1);
        // Kontratınızdaki hata mesajı: "Arweave TX ID cannot be empty"
        vm.expectRevert(bytes("Arweave TX ID cannot be empty"));
        metadataStorage.addFile("fileNameValid", "", "text/plain");
        // vm.stopPrank(); // Revert sonrası bu satıra ulaşılmaz, isteğe bağlı
    }
}