// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {TestAsset} from "../src/TestAsset.sol";
import {VaultFactory} from "../src/VaultFactory.sol";

/// @notice Local deployment order for a later approved testnet broadcast.
/// @dev Do not broadcast to Base Sepolia until the contract tests have passed and deployment is approved.
contract DeployScript is Script {
    function run() external {
        vm.startBroadcast();
        TestAsset asset = new TestAsset();
        VaultFactory factory = new VaultFactory(address(asset));
        vm.stopBroadcast();

        console2.log("TestAsset", address(asset));
        console2.log("VaultFactory", address(factory));
    }
}
