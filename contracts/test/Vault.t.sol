// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {TestAsset} from "../src/TestAsset.sol";
import {Vault} from "../src/Vault.sol";
import {VaultFactory} from "../src/VaultFactory.sol";

contract VaultTest is Test {
    uint256 internal constant ONE = 1 ether;

    TestAsset internal asset;
    TestAsset internal otherAsset;
    VaultFactory internal factory;
    Vault internal vault;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    function setUp() public {
        asset = new TestAsset();
        otherAsset = new TestAsset();
        factory = new VaultFactory(address(asset));
        vault = Vault(factory.createVault("Demonstration Vault", "vSHARE"));
    }

    function test_factoryRejectsEmptyAccountAndZeroAddress() public {
        vm.expectRevert(VaultFactory.InvalidTestAsset.selector);
        new VaultFactory(address(0));

        vm.expectRevert(VaultFactory.InvalidTestAsset.selector);
        new VaultFactory(alice);
    }

    function test_factoryRejectsEmptyAndOversizedLabels() public {
        vm.expectRevert(VaultFactory.EmptyName.selector);
        factory.createVault("", "vSHARE");

        vm.expectRevert(VaultFactory.EmptySymbol.selector);
        factory.createVault("Demonstration Vault", "");

        vm.expectRevert(VaultFactory.NameTooLong.selector);
        factory.createVault(_repeated("n", 65), "vSHARE");

        vm.expectRevert(VaultFactory.SymbolTooLong.selector);
        factory.createVault("Demonstration Vault", _repeated("s", 17));
    }

    function test_factoryUsesOnlyTheApprovedAsset() public view {
        assertEq(vault.asset(), address(asset));
        assertEq(factory.testAsset(), address(asset));
        assertTrue(factory.isVault(address(vault)));
        assertEq(vault.name(), "Demonstration Vault");
        assertEq(vault.symbol(), "vSHARE");
        assertEq(vault.deployer(), address(this));
        assertEq(vault.decimals(), 18);
    }

    function test_factoryEventRecordsTheCreatedVault() public {
        vm.recordLogs();
        vm.prank(alice);
        address created = factory.createVault("Second", "TWO");

        Vm.Log[] memory entries = vm.getRecordedLogs();
        assertEq(entries.length, 1);
        assertEq(entries[0].topics[1], bytes32(uint256(uint160(created))));
        assertEq(entries[0].topics[2], bytes32(uint256(uint160(address(asset)))));
        assertEq(entries[0].topics[3], bytes32(uint256(uint160(alice))));
        (string memory emittedName, string memory emittedSymbol) = abi.decode(entries[0].data, (string, string));
        assertEq(emittedName, "Second");
        assertEq(emittedSymbol, "TWO");
        assertEq(Vault(created).asset(), address(asset));
        assertFalse(Vault(created).asset() == address(otherAsset));
    }

    function test_zeroDepositAndZeroRedeemFollowOpenZeppelin() public {
        _fund(alice, ONE);

        vm.startPrank(alice);
        asset.approve(address(vault), type(uint256).max);

        uint256 supplyBefore = vault.totalSupply();
        uint256 sharesFromZero = vault.deposit(0, alice);
        assertEq(sharesFromZero, 0);
        assertEq(vault.totalSupply(), supplyBefore);
        assertEq(vault.balanceOf(alice), 0);
        assertEq(vault.previewDeposit(0), 0);

        uint256 minted = vault.deposit(ONE, alice);
        assertGt(minted, 0);

        uint256 assetsBefore = asset.balanceOf(alice);
        uint256 shareBalanceBefore = vault.balanceOf(alice);
        uint256 assetsFromZero = vault.redeem(0, alice, alice);
        assertEq(assetsFromZero, 0);
        assertEq(asset.balanceOf(alice), assetsBefore);
        assertEq(vault.balanceOf(alice), shareBalanceBefore);
        assertEq(vault.previewRedeem(0), 0);

        uint256 sharesFromZeroWithdraw = vault.withdraw(0, alice, alice);
        assertEq(sharesFromZeroWithdraw, 0);
        assertEq(vault.balanceOf(alice), shareBalanceBefore);
        vm.stopPrank();
    }

    function test_depositMintsThePreviewedShares() public {
        _fund(alice, 25 ether);

        vm.startPrank(alice);
        asset.approve(address(vault), type(uint256).max);
        uint256 expectedShares = vault.previewDeposit(25 ether);
        uint256 minted = vault.deposit(25 ether, alice);
        vm.stopPrank();

        assertEq(minted, expectedShares);
        assertEq(vault.balanceOf(alice), expectedShares);
        assertEq(vault.totalSupply(), expectedShares);
        assertEq(vault.totalAssets(), 25 ether);
        assertEq(vault.convertToShares(25 ether), expectedShares);
        assertEq(vault.convertToAssets(expectedShares), 25 ether);
    }

    function test_smallDepositOnAnEmptyVaultMintsOneToOne() public {
        _fund(alice, 1);

        vm.startPrank(alice);
        asset.approve(address(vault), type(uint256).max);
        uint256 minted = vault.deposit(1, alice);
        vm.stopPrank();

        assertEq(minted, 1);
        assertEq(vault.totalSupply(), 1);
        assertEq(vault.totalAssets(), 1);
        assertEq(vault.maxRedeem(alice), 1);
    }

    function test_redeemAndWithdrawReturnAssetsAndBurnShares() public {
        _fund(alice, 10 ether);
        vm.startPrank(alice);
        asset.approve(address(vault), type(uint256).max);
        uint256 shares = vault.deposit(10 ether, alice);

        uint256 redeemed = vault.redeem(shares / 2, alice, alice);
        assertEq(redeemed, vault.previewRedeem(shares / 2));
        assertEq(vault.balanceOf(alice), shares - shares / 2);
        assertEq(vault.totalSupply(), shares - shares / 2);

        uint256 burned = vault.withdraw(vault.maxWithdraw(alice), alice, alice);
        assertEq(vault.balanceOf(alice), 0);
        assertEq(vault.totalSupply(), 0);
        assertEq(burned, shares - shares / 2);
        vm.stopPrank();
    }

    function test_shareTransferMovesBalancesWithoutChangingSupply() public {
        _fund(alice, 8 ether);
        vm.startPrank(alice);
        asset.approve(address(vault), type(uint256).max);
        uint256 shares = vault.deposit(8 ether, alice);
        uint256 supply = vault.totalSupply();

        vault.transfer(bob, 3 ether);
        vm.stopPrank();

        assertEq(vault.totalSupply(), supply);
        assertEq(vault.balanceOf(alice), shares - 3 ether);
        assertEq(vault.balanceOf(bob), 3 ether);
        assertEq(vault.totalAssets(), 8 ether);

        vm.startPrank(bob);
        uint256 assets = vault.redeem(3 ether, bob, bob);
        vm.stopPrank();

        assertEq(assets, 3 ether);
        assertEq(vault.totalSupply(), supply - 3 ether);
        assertEq(vault.balanceOf(bob), 0);
        assertEq(asset.balanceOf(bob), 3 ether);
    }

    function test_strangerCannotRedeemAnotherWalletsShares() public {
        _fund(alice, 4 ether);
        vm.startPrank(alice);
        asset.approve(address(vault), type(uint256).max);
        uint256 shares = vault.deposit(4 ether, alice);
        vm.stopPrank();

        vm.startPrank(bob);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, bob, 0, shares)
        );
        vault.redeem(shares, bob, alice);
        vm.stopPrank();

        assertEq(vault.balanceOf(alice), shares);
        assertEq(vault.totalSupply(), shares);
    }

    function test_approvedSpenderCanWithdrawOnBehalfOfOwner() public {
        _fund(alice, 4 ether);
        vm.startPrank(alice);
        asset.approve(address(vault), type(uint256).max);
        vault.deposit(4 ether, alice);
        vault.approve(bob, 1 ether);
        vm.stopPrank();

        vm.prank(bob);
        uint256 burned = vault.withdraw(1 ether, bob, alice);

        assertEq(burned, 1 ether);
        assertEq(asset.balanceOf(bob), 1 ether);
        assertEq(vault.balanceOf(alice), 3 ether);
        assertEq(vault.allowance(alice, bob), 0);
    }

    function test_withdrawAboveBalanceReverts() public {
        _fund(alice, 2 ether);
        vm.startPrank(alice);
        asset.approve(address(vault), type(uint256).max);
        vault.deposit(2 ether, alice);

        vm.expectRevert(
            abi.encodeWithSelector(
                ERC4626.ERC4626ExceededMaxWithdraw.selector, alice, 2 ether + 1, 2 ether
            )
        );
        vault.withdraw(2 ether + 1, alice, alice);

        vm.expectRevert(
            abi.encodeWithSelector(ERC4626.ERC4626ExceededMaxRedeem.selector, alice, 2 ether + 1, 2 ether)
        );
        vault.redeem(2 ether + 1, alice, alice);
        vm.stopPrank();
    }

    function test_depositToZeroAddressReverts() public {
        _fund(alice, 1 ether);
        vm.startPrank(alice);
        asset.approve(address(vault), type(uint256).max);
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InvalidReceiver.selector, address(0)));
        vault.deposit(1 ether, address(0));
        vm.stopPrank();
    }

    function test_directAssetTransferIncreasesTotalAssets() public {
        _fund(alice, 5 ether);
        vm.prank(alice);
        asset.transfer(address(vault), 5 ether);

        assertEq(vault.totalAssets(), 5 ether);
        assertEq(vault.totalSupply(), 0);
        assertEq(vault.previewDeposit(1 ether), 0);
    }

    function test_nonzeroDepositThatWouldMintZeroSharesRevertsWithoutTakingTokens() public {
        assertEq(vault.totalAssets(), 0);
        assertEq(vault.totalSupply(), 0);

        _fund(alice, 1 ether);
        vm.startPrank(alice);
        asset.approve(address(vault), type(uint256).max);
        uint256 shares = vault.deposit(1 ether, alice);
        vm.stopPrank();
        assertEq(shares, 1 ether);
        assertEq(vault.totalSupply(), 1 ether);

        vm.prank(alice);
        vault.redeem(shares, alice, alice);
        assertEq(vault.totalSupply(), 0);
        assertEq(vault.totalAssets(), 0);
        assertEq(asset.balanceOf(alice), 1 ether);

        _fund(bob, 1_000 ether + 1 ether);
        vm.prank(bob);
        asset.transfer(address(vault), 1_000 ether);
        assertEq(vault.totalAssets(), 1_000 ether);
        assertEq(vault.totalSupply(), 0);
        assertEq(vault.previewDeposit(1 ether), 0);

        uint256 bobBalance = asset.balanceOf(bob);
        vm.startPrank(bob);
        asset.approve(address(vault), type(uint256).max);
        uint256 zeroShares = vault.deposit(0, bob);
        assertEq(zeroShares, 0);
        assertEq(asset.balanceOf(bob), bobBalance);

        vm.expectRevert(abi.encodeWithSelector(Vault.ZeroShareDeposit.selector, 1 ether));
        vault.deposit(1 ether, bob);
        vm.stopPrank();

        assertEq(asset.balanceOf(bob), bobBalance);
        assertEq(vault.balanceOf(bob), 0);
        assertEq(vault.totalSupply(), 0);
        assertEq(vault.totalAssets(), 1_000 ether);
    }

    function test_referenceVaultIsPublicAndIsNotAUserVault() public {
        vm.recordLogs();
        VaultFactory fresh = new VaultFactory(address(asset));
        Vm.Log[] memory entries = vm.getRecordedLogs();

        address pinned = fresh.referenceVault();
        assertTrue(pinned != address(0));
        assertEq(entries.length, 1);
        assertEq(entries[0].topics[0], VaultFactory.ReferenceVaultPinned.selector);
        assertTrue(entries[0].topics[0] != VaultFactory.VaultCreated.selector);
        assertEq(address(uint160(uint256(entries[0].topics[1]))), pinned);

        assertFalse(fresh.isVault(pinned));
        assertEq(Vault(pinned).deployer(), address(fresh));
        assertEq(Vault(pinned).name(), "Reference Vault");
        assertEq(Vault(pinned).symbol(), "REF");
        assertEq(pinned.codehash, fresh.referenceCodehash());
        assertTrue(fresh.matchesApprovedVaultCode(pinned));

        vm.prank(alice);
        address userVault = fresh.createVault("Customer", "CST");
        assertTrue(userVault != pinned);
        assertTrue(fresh.isVault(userVault));
        assertFalse(fresh.isVault(pinned));
        assertEq(Vault(userVault).deployer(), alice);
    }

    function test_vaultConstructorRejectsZeroDeployer() public {
        vm.expectRevert(Vault.ZeroDeployer.selector);
        new Vault(IERC20(address(asset)), "Direct", "DIR", address(0));
    }

    function test_testAssetMintRejectsZero() public {
        vm.expectRevert(TestAsset.ZeroAmount.selector);
        asset.mint(alice, 0);

        vm.expectRevert(TestAsset.ZeroReceiver.selector);
        asset.mint(address(0), 1);
    }

    function test_shareSupplyChangesOnlyThroughDepositAndRedeem() public {
        uint256 supply = vault.totalSupply();
        asset.mint(alice, 3 ether);
        assertEq(vault.totalSupply(), supply);

        vm.startPrank(alice);
        asset.approve(address(vault), type(uint256).max);
        vault.deposit(3 ether, alice);
        uint256 afterDeposit = vault.totalSupply();
        assertGt(afterDeposit, supply);

        vault.transfer(bob, 1 ether);
        assertEq(vault.totalSupply(), afterDeposit);
        vm.stopPrank();

        vm.prank(bob);
        vault.redeem(1 ether, bob, bob);
        assertEq(vault.totalSupply(), afterDeposit - 1 ether);
    }

    function test_runtimeHashDiffersWhenTheImmutableAssetDiffers() public {
        Vault other = new Vault(IERC20(address(otherAsset)), "Other", "OTH", address(this));

        assertTrue(factory.matchesApprovedVaultCode(address(vault)));
        assertFalse(factory.matchesApprovedVaultCode(address(other)));
        assertNotEq(address(vault).codehash, address(other).codehash);
        assertEq(address(vault).code.length, address(other).code.length);
        assertGt(_firstDifferingByte(address(vault).code, address(other).code), 0);
        assertEq(other.asset(), address(otherAsset));
    }

    function test_sameAssetDifferentLabelsKeepTheSameRuntimeHash() public {
        Vault second = Vault(factory.createVault("Another", "TWO"));

        assertEq(address(vault).codehash, address(second).codehash);
        assertEq(address(vault).codehash, factory.referenceCodehash());
        assertTrue(factory.matchesApprovedVaultCode(address(second)));
        assertEq(vault.name(), "Demonstration Vault");
        assertEq(second.name(), "Another");
    }

    function test_codeCheckRejectsContractsThatAreNotThisVault() public view {
        assertFalse(factory.matchesApprovedVaultCode(address(asset)));
        assertFalse(factory.matchesApprovedVaultCode(address(factory)));
        assertFalse(factory.matchesApprovedVaultCode(alice));
        assertFalse(factory.matchesApprovedVaultCode(address(0)));
    }

    function test_sameAssetOutsideTheFactoryMatchesCodeButIsNotRegistered() public {
        Vault externalVault = new Vault(IERC20(address(asset)), "External", "EXT", address(this));

        assertEq(address(externalVault).codehash, factory.referenceCodehash());
        assertTrue(factory.matchesApprovedVaultCode(address(externalVault)));
        assertFalse(factory.isVault(address(externalVault)));
    }

    function testFuzz_depositThenRedeemReturnsTheDeposit(uint96 rawAmount) public {
        uint256 amount = bound(rawAmount, 1, 1_000_000 ether);
        _fund(alice, amount);

        vm.startPrank(alice);
        asset.approve(address(vault), type(uint256).max);
        uint256 shares = vault.deposit(amount, alice);
        assertEq(shares, vault.previewDeposit(amount));
        uint256 returned = vault.redeem(shares, alice, alice);
        vm.stopPrank();

        assertEq(returned, amount);
        assertEq(vault.totalSupply(), 0);
        assertEq(vault.totalAssets(), 0);
        assertEq(asset.balanceOf(alice), amount);
    }

    function testFuzz_transferPreservesSupply(uint96 rawAmount, uint96 rawSend) public {
        uint256 amount = bound(rawAmount, 1, 1_000_000 ether);
        _fund(alice, amount);

        vm.startPrank(alice);
        asset.approve(address(vault), type(uint256).max);
        uint256 shares = vault.deposit(amount, alice);
        uint256 send = bound(rawSend, 0, shares);
        vault.transfer(bob, send);
        vm.stopPrank();

        assertEq(vault.totalSupply(), shares);
        assertEq(vault.balanceOf(alice) + vault.balanceOf(bob), shares);
    }

    function _firstDifferingByte(bytes memory left, bytes memory right) internal pure returns (uint256) {
        uint256 length = left.length < right.length ? left.length : right.length;
        for (uint256 i = 0; i < length; ++i) {
            if (left[i] != right[i]) return i + 1;
        }
        return 0;
    }

    function _fund(address account, uint256 amount) internal {
        asset.mint(account, amount);
    }

    function _repeated(string memory unit, uint256 count) internal pure returns (string memory output) {
        output = unit;
        for (uint256 i = 1; i < count; ++i) {
            output = string.concat(output, unit);
        }
    }
}
