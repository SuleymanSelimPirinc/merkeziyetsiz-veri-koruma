// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {MetadataStorage} from "../src/MetadataStorage.sol";

contract DeployMetadataStorage is Script {
    function run() external returns (MetadataStorage) {
        vm.startBroadcast();

        console.log("Deploying MetadataStorage contract to Sepolia...");
        MetadataStorage metadataStorage = new MetadataStorage();
        console.log("MetadataStorage contract deployed to address:", address(metadataStorage));

        vm.stopBroadcast();
        return metadataStorage;
    }
}