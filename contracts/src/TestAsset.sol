// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Mintable ERC-20 used only as the approved underlying asset for the testnet demonstration.
/// @dev Public mint is a faucet. This contract is not a production settlement asset.
contract TestAsset is ERC20 {
    error ZeroReceiver();
    error ZeroAmount();

    constructor() ERC20("VaultOS Test Asset", "vUSD") {}

    /// @notice Mints `amount` tokens to `to`. Anyone may call this on the testnet demonstration.
    function mint(address to, uint256 amount) external {
        if (to == address(0)) revert ZeroReceiver();
        if (amount == 0) revert ZeroAmount();
        _mint(to, amount);
    }
}
