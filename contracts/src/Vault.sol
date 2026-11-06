// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title Vault
/// @notice ERC-4626 vault over one underlying asset. Share accounting is OpenZeppelin's implementation.
/// @dev The underlying asset and its decimals are immutables inside OpenZeppelin's ERC-4626, so two
/// vaults do not share a runtime bytecode hash when those constructor values differ. Name, symbol,
/// and deployer are stored in contract storage and do not change the runtime bytecode.
contract Vault is ERC4626 {
    /// @notice Wallet that asked the factory to create this vault. Stored, not immutable.
    address public deployer;

    error ZeroDeployer();
    /// @notice A nonzero asset deposit would have minted zero shares.
    error ZeroShareDeposit(uint256 assets);

    constructor(IERC20 asset_, string memory name_, string memory symbol_, address deployer_)
        ERC20(name_, symbol_)
        ERC4626(asset_)
    {
        if (deployer_ == address(0)) revert ZeroDeployer();
        deployer = deployer_;
    }

    /// @dev OpenZeppelin allows a deposit of zero assets, which mints zero shares. That path is unchanged.
    /// A nonzero deposit that rounds down to zero shares is rejected before the asset transfer.
    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override {
        if (assets > 0 && shares == 0) revert ZeroShareDeposit(assets);
        super._deposit(caller, receiver, assets, shares);
    }
}
