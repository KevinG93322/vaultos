// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Vault} from "./Vault.sol";

/// @notice Deploys {Vault} contracts for one approved test asset.
/// @dev Callers cannot pass an arbitrary ERC-20. The asset address and its decimals are immutables inside
/// each vault, so runtime bytecode hashes match only when those values match. The constructor deploys
/// {referenceVault} solely to pin {referenceCodehash} for this asset. That vault is not a customer vault:
/// it is excluded from {isVault} and does not emit {VaultCreated}. The hash is valid for this asset only.
/// It is not a universal hash for every {Vault}.
contract VaultFactory is ReentrancyGuard {
    uint256 public constant MAX_NAME_BYTES = 64;
    uint256 public constant MAX_SYMBOL_BYTES = 16;

    /// @notice The only underlying asset this factory will wrap.
    address public immutable testAsset;

    /// @notice Bytecode reference deployed by the constructor for {testAsset}.
    /// @dev Public getter: {referenceVault}. This address exists only to pin {referenceCodehash}.
    /// It is not included in {isVault} and must not be registered as a customer-created vault.
    address public immutable referenceVault;

    /// @notice Runtime code hash of a {Vault} whose immutable asset is {testAsset}.
    bytes32 public immutable referenceCodehash;

    /// @notice True only for vaults created through {createVault}. The reference vault is never set.
    mapping(address vault => bool created) public isVault;

    error InvalidTestAsset();
    error EmptyName();
    error EmptySymbol();
    error NameTooLong();
    error SymbolTooLong();
    error UnexpectedVaultCode();

    event VaultCreated(
        address indexed vault,
        address indexed asset,
        address indexed deployer,
        string name,
        string symbol
    );

    /// @notice Emitted once for the constructor's bytecode reference. This is not a customer vault.
    event ReferenceVaultPinned(address indexed vault, address indexed asset, bytes32 codehash);

    constructor(address testAsset_) {
        if (testAsset_.code.length == 0) revert InvalidTestAsset();
        (bool ok, bytes memory encoded) = testAsset_.staticcall(abi.encodeCall(IERC20Metadata.decimals, ()));
        if (!ok || encoded.length < 32) revert InvalidTestAsset();
        if (abi.decode(encoded, (uint256)) > type(uint8).max) revert InvalidTestAsset();

        testAsset = testAsset_;
        address created = address(new Vault(IERC20(testAsset_), "Reference Vault", "REF", address(this)));
        referenceVault = created;
        referenceCodehash = created.codehash;

        emit ReferenceVaultPinned(created, testAsset_, created.codehash);
    }

    /// @notice Deploys a vault for {testAsset}. `msg.sender` is recorded as the deployer.
    function createVault(string calldata name_, string calldata symbol_)
        external
        nonReentrant
        returns (address vault)
    {
        if (bytes(name_).length == 0) revert EmptyName();
        if (bytes(symbol_).length == 0) revert EmptySymbol();
        if (bytes(name_).length > MAX_NAME_BYTES) revert NameTooLong();
        if (bytes(symbol_).length > MAX_SYMBOL_BYTES) revert SymbolTooLong();

        vault = address(new Vault(IERC20(testAsset), name_, symbol_, msg.sender));
        if (vault.codehash != referenceCodehash) revert UnexpectedVaultCode();
        isVault[vault] = true;

        emit VaultCreated(vault, testAsset, msg.sender, name_, symbol_);
    }

    /// @notice True when `vault` has the runtime code produced for {testAsset} by this compilation.
    /// @dev A matching hash does not prove this factory deployed `vault`. Pair it with {isVault}
    /// or the {VaultCreated} event. A vault constructed with a different asset has a different hash
    /// because that asset is an immutable in the runtime bytecode.
    function matchesApprovedVaultCode(address vault) external view returns (bool) {
        if (vault.code.length == 0 || vault.codehash != referenceCodehash) return false;
        return Vault(vault).asset() == testAsset;
    }
}
