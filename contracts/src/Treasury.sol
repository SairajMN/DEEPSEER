// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Treasury is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant MARKET_ROLE = keccak256("MARKET_ROLE");
    bytes32 public constant MARKET_MANAGER_ROLE = keccak256("MARKET_MANAGER_ROLE");
    bytes32 public constant TREASURER_ROLE = keccak256("TREASURER_ROLE");

    error InvalidAddress();
    error InvalidAmount();
    error InvalidFeeBps();
    error InsufficientMarketEscrow(uint256 available, uint256 requested);
    error FeeExceedsGross(uint256 grossAmount, uint256 feeAmount);
    error FeeWithdrawalExceedsAccrued(uint256 accrued, uint256 requested);

    event StakeEscrowed(address indexed market, address indexed payer, uint256 amount, uint256 marketEscrowBalance);
    event PayoutReleased(
        address indexed market,
        address indexed recipient,
        uint256 grossAmount,
        uint256 feeAmount,
        uint256 netAmount,
        uint256 marketEscrowBalance
    );
    event RefundReleased(
        address indexed market,
        address indexed recipient,
        uint256 amount,
        uint256 marketEscrowBalance
    );
    event ProtocolFeeBpsUpdated(uint16 previousFeeBps, uint16 newFeeBps);
    event ProtocolFeesWithdrawn(address indexed recipient, uint256 amount, uint256 remainingAccruedFees);
    event MarketAuthorizationUpdated(address indexed market, bool isAuthorized);

    IERC20 public immutable collateralToken;

    uint16 public protocolFeeBps;
    uint256 public accruedProtocolFees;

    mapping(address market => uint256 escrowed) public marketEscrow;

    constructor(address admin, address pauser, address treasurer, address collateral, uint16 initialFeeBps) {
        if (admin == address(0) || pauser == address(0) || treasurer == address(0) || collateral == address(0)) {
            revert InvalidAddress();
        }
        if (initialFeeBps > 1_000) revert InvalidFeeBps();

        collateralToken = IERC20(collateral);
        protocolFeeBps = initialFeeBps;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, pauser);
        _grantRole(TREASURER_ROLE, treasurer);
        _grantRole(MARKET_MANAGER_ROLE, admin);
    }

    function setProtocolFeeBps(uint16 newFeeBps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newFeeBps > 1_000) revert InvalidFeeBps();
        uint16 previous = protocolFeeBps;
        protocolFeeBps = newFeeBps;
        emit ProtocolFeeBpsUpdated(previous, newFeeBps);
    }

    function escrowStake(address payer, uint256 amount) external nonReentrant whenNotPaused onlyRole(MARKET_ROLE) {
        if (payer == address(0)) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();

        collateralToken.safeTransferFrom(payer, address(this), amount);
        marketEscrow[msg.sender] += amount;

        emit StakeEscrowed(msg.sender, payer, amount, marketEscrow[msg.sender]);
    }

    function payout(address recipient, uint256 grossAmount, uint256 feeAmount)
        external
        nonReentrant
        whenNotPaused
        onlyRole(MARKET_ROLE)
    {
        if (recipient == address(0)) revert InvalidAddress();
        if (grossAmount == 0) revert InvalidAmount();
        if (feeAmount > grossAmount) revert FeeExceedsGross(grossAmount, feeAmount);

        uint256 escrowBalance = marketEscrow[msg.sender];
        if (escrowBalance < grossAmount) {
            revert InsufficientMarketEscrow(escrowBalance, grossAmount);
        }

        unchecked {
            marketEscrow[msg.sender] = escrowBalance - grossAmount;
        }
        accruedProtocolFees += feeAmount;

        uint256 netAmount = grossAmount - feeAmount;
        collateralToken.safeTransfer(recipient, netAmount);

        emit PayoutReleased(msg.sender, recipient, grossAmount, feeAmount, netAmount, marketEscrow[msg.sender]);
    }

    function refund(address recipient, uint256 amount) external nonReentrant whenNotPaused onlyRole(MARKET_ROLE) {
        if (recipient == address(0)) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();

        uint256 escrowBalance = marketEscrow[msg.sender];
        if (escrowBalance < amount) {
            revert InsufficientMarketEscrow(escrowBalance, amount);
        }

        unchecked {
            marketEscrow[msg.sender] = escrowBalance - amount;
        }
        collateralToken.safeTransfer(recipient, amount);

        emit RefundReleased(msg.sender, recipient, amount, marketEscrow[msg.sender]);
    }

    function withdrawProtocolFees(address recipient, uint256 amount)
        external
        nonReentrant
        whenNotPaused
        onlyRole(TREASURER_ROLE)
    {
        if (recipient == address(0)) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();
        if (amount > accruedProtocolFees) {
            revert FeeWithdrawalExceedsAccrued(accruedProtocolFees, amount);
        }

        accruedProtocolFees -= amount;
        collateralToken.safeTransfer(recipient, amount);

        emit ProtocolFeesWithdrawn(recipient, amount, accruedProtocolFees);
    }

    function addMarket(address market) external onlyRole(MARKET_MANAGER_ROLE) {
        if (market == address(0)) revert InvalidAddress();
        _grantRole(MARKET_ROLE, market);
        emit MarketAuthorizationUpdated(market, true);
    }

    function removeMarket(address market) external onlyRole(MARKET_MANAGER_ROLE) {
        if (market == address(0)) revert InvalidAddress();
        _revokeRole(MARKET_ROLE, market);
        emit MarketAuthorizationUpdated(market, false);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
