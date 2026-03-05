// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

import {ITreasury} from "./interfaces/ITreasury.sol";
import {IPredictionMarket} from "./interfaces/IPredictionMarket.sol";
import {RiskOracleInterface} from "./interfaces/RiskOracleInterface.sol";

contract PredictionMarket is IPredictionMarket, AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant SETTLEMENT_ROLE = keccak256("SETTLEMENT_ROLE");

    enum Side {
        None,
        Bull,
        Bear
    }

    enum Outcome {
        Unresolved,
        Bull,
        Bear
    }

    struct Bet {
        Side side;
        uint128 amount;
        bool claimed;
    }

    struct InitParams {
        address admin;
        address pauser;
        address settlementEngine;
        address treasury;
        address priceFeed;
        string marketQuestion;
        uint64 lockTimestamp;
        uint64 expiryTimestamp;
        uint64 maxOracleDelay;
        uint32 minBetLeadTime;
        uint128 minBetAmount;
        uint16 minConfidenceScore;
        uint16 minSourceConsensus;
        uint16 maxExternalDeviationBps;
    }

    error InvalidTimestampWindow();
    error InvalidAddress();
    error InvalidPhase(Phase expected, Phase current);
    error BettingClosed(uint64 lockTimestamp, uint32 minBetLeadTime);
    error InvalidBetAmount();
    error InvalidSide();
    error BetSideChangeNotAllowed(Side existingSide, Side attemptedSide);
    error ResolutionAlreadyRequested();
    error OracleStale(uint256 updatedAt, uint256 currentTs);
    error OracleInvalidRound();
    error OracleNegativeOrZeroPrice(int256 price);
    error FinalPriceNotAfterLockPrice(uint64 finalPriceTimestamp, uint64 lockPriceTimestamp);
    error ResolutionNotOpen();
    error ClaimNotAvailable(Phase current);
    error NoBetFound();
    error BetAlreadyClaimed();
    error BetLost();
    error InvalidExternalPriceTimestamp(uint64 externalTimestamp, uint64 nowTs);

    event BetPlaced(address indexed user, Side indexed side, uint256 amount, uint256 updatedUserStake);
    event MarketLocked(int256 indexed lockPrice, uint64 indexed lockPriceTimestamp);
    event ResolutionWindowOpened(uint64 indexed at);
    event MarketResolved(
        Outcome indexed outcome,
        int256 indexed lockPrice,
        int256 indexed finalPrice,
        uint16 confidenceScore,
        uint16 sourceConsensus,
        bytes32 evidenceHash
    );
    event MarketCancelled(
        bytes32 indexed reasonCode,
        uint16 confidenceScore,
        uint16 sourceConsensus,
        bool anomalyFlag,
        bytes32 evidenceHash
    );
    event RewardClaimed(address indexed user, uint256 grossAmount, uint256 feeAmount, uint256 netAmount);
    event RefundClaimed(address indexed user, uint256 refundAmount);

    string public marketQuestion;

    ITreasury public immutable treasury;
    IERC20 public immutable collateralToken;
    AggregatorV3Interface public immutable priceFeed;

    uint64 public immutable lockTimestamp;
    uint64 public immutable expiryTimestamp;
    uint64 public immutable maxOracleDelay;
    uint32 public immutable minBetLeadTime;
    uint128 public immutable minBetAmount;
    uint16 public immutable minConfidenceScore;
    uint16 public immutable minSourceConsensus;
    uint16 public immutable maxExternalDeviationBps;

    Phase public phase;
    Outcome public outcome;

    int256 public lockPrice;
    int256 public finalPrice;
    uint64 public lockPriceTimestamp;
    uint64 public finalPriceTimestamp;
    bool public resolutionRequested;

    uint256 public totalBullPool;
    uint256 public totalBearPool;
    uint256 public totalStaked;
    uint256 public totalClaimed;

    mapping(address user => Bet bet) private s_bets;

    constructor(InitParams memory params) {
        if (
            params.admin == address(0) || params.pauser == address(0) || params.settlementEngine == address(0)
                || params.treasury == address(0) || params.priceFeed == address(0)
        ) revert InvalidAddress();

        if (
            params.lockTimestamp <= block.timestamp || params.expiryTimestamp <= params.lockTimestamp
                || params.maxOracleDelay == 0 || params.minBetAmount == 0
        ) revert InvalidTimestampWindow();

        marketQuestion = params.marketQuestion;
        treasury = ITreasury(params.treasury);
        collateralToken = IERC20(ITreasury(params.treasury).collateralToken());
        priceFeed = AggregatorV3Interface(params.priceFeed);

        lockTimestamp = params.lockTimestamp;
        expiryTimestamp = params.expiryTimestamp;
        maxOracleDelay = params.maxOracleDelay;
        minBetLeadTime = params.minBetLeadTime;
        minBetAmount = params.minBetAmount;
        minConfidenceScore = params.minConfidenceScore;
        minSourceConsensus = params.minSourceConsensus;
        maxExternalDeviationBps = params.maxExternalDeviationBps;

        phase = Phase.Trading;
        outcome = Outcome.Unresolved;

        _grantRole(DEFAULT_ADMIN_ROLE, params.admin);
        _grantRole(PAUSER_ROLE, params.pauser);
        _grantRole(SETTLEMENT_ROLE, params.settlementEngine);
    }

    function placeBet(Side side, uint256 amount) external nonReentrant whenNotPaused {
        if (phase != Phase.Trading) revert InvalidPhase(Phase.Trading, phase);
        if (block.timestamp + minBetLeadTime >= lockTimestamp) {
            revert BettingClosed(lockTimestamp, minBetLeadTime);
        }
        if (amount < minBetAmount) revert InvalidBetAmount();
        if (side != Side.Bull && side != Side.Bear) revert InvalidSide();

        Bet storage userBet = s_bets[msg.sender];
        if (userBet.amount > 0 && userBet.side != side) {
            revert BetSideChangeNotAllowed(userBet.side, side);
        }

        userBet.side = side;
        userBet.amount += uint128(amount);

        if (side == Side.Bull) {
            totalBullPool += amount;
        } else {
            totalBearPool += amount;
        }
        totalStaked += amount;

        treasury.escrowStake(msg.sender, amount);

        emit BetPlaced(msg.sender, side, amount, userBet.amount);
    }

    function lockRound() external whenNotPaused onlyRole(SETTLEMENT_ROLE) {
        if (phase != Phase.Trading) revert InvalidPhase(Phase.Trading, phase);
        if (block.timestamp < lockTimestamp) revert InvalidTimestampWindow();

        (int256 observedPrice, uint64 observedTimestamp) = _readValidatedFeedPrice();
        lockPrice = observedPrice;
        lockPriceTimestamp = observedTimestamp;
        phase = Phase.Locked;

        emit MarketLocked(observedPrice, observedTimestamp);
    }

    function openResolutionWindow() external whenNotPaused onlyRole(SETTLEMENT_ROLE) {
        if (phase != Phase.Locked) revert InvalidPhase(Phase.Locked, phase);
        if (block.timestamp < expiryTimestamp) revert ResolutionNotOpen();
        if (resolutionRequested) revert ResolutionAlreadyRequested();

        resolutionRequested = true;
        emit ResolutionWindowOpened(uint64(block.timestamp));
    }

    function resolveMarket(
        RiskOracleInterface.RiskAssessment calldata assessment,
        int256 externalPrice,
        uint64 externalPriceTimestamp
    ) external whenNotPaused onlyRole(SETTLEMENT_ROLE) {
        if (phase != Phase.Locked) revert InvalidPhase(Phase.Locked, phase);
        if (!resolutionRequested) revert ResolutionNotOpen();
        if (block.timestamp < expiryTimestamp) revert ResolutionNotOpen();

        (int256 observedFinalPrice, uint64 observedFinalTimestamp) = _readValidatedFeedPrice();
        if (observedFinalTimestamp <= lockPriceTimestamp) {
            revert FinalPriceNotAfterLockPrice(observedFinalTimestamp, lockPriceTimestamp);
        }

        bool anomaly = assessment.anomalyFlag;

        if (assessment.confidenceScore < minConfidenceScore || assessment.sourceConsensus < minSourceConsensus) {
            anomaly = true;
        }

        if (externalPrice != 0) {
            if (externalPriceTimestamp == 0 || externalPriceTimestamp + maxOracleDelay < block.timestamp) {
                revert InvalidExternalPriceTimestamp(externalPriceTimestamp, uint64(block.timestamp));
            }
            uint256 deviation = _deviationBps(_abs(observedFinalPrice), _abs(externalPrice));
            if (deviation > maxExternalDeviationBps) {
                anomaly = true;
            }
        }

        finalPrice = observedFinalPrice;
        finalPriceTimestamp = observedFinalTimestamp;

        if (anomaly || observedFinalPrice == lockPrice) {
            phase = Phase.Cancelled;
            outcome = Outcome.Unresolved;
            emit MarketCancelled(
                keccak256("RISK_OR_PRICE_TIE"),
                assessment.confidenceScore,
                assessment.sourceConsensus,
                anomaly,
                assessment.evidenceHash
            );
            return;
        }

        outcome = observedFinalPrice > lockPrice ? Outcome.Bull : Outcome.Bear;
        phase = Phase.Resolved;

        emit MarketResolved(
            outcome,
            lockPrice,
            observedFinalPrice,
            assessment.confidenceScore,
            assessment.sourceConsensus,
            assessment.evidenceHash
        );
    }

    function claim() external nonReentrant whenNotPaused {
        if (phase != Phase.Resolved && phase != Phase.Cancelled) revert ClaimNotAvailable(phase);

        Bet storage userBet = s_bets[msg.sender];
        if (userBet.amount == 0) revert NoBetFound();
        if (userBet.claimed) revert BetAlreadyClaimed();

        userBet.claimed = true;

        if (phase == Phase.Cancelled) {
            uint256 refundAmount = uint256(userBet.amount);
            totalClaimed += refundAmount;
            treasury.refund(msg.sender, refundAmount);
            emit RefundClaimed(msg.sender, refundAmount);
            return;
        }

        if (!_isWinningBet(userBet.side)) revert BetLost();

        uint256 userStake = uint256(userBet.amount);
        uint256 winningPool = outcome == Outcome.Bull ? totalBullPool : totalBearPool;
        uint256 losingPool = outcome == Outcome.Bull ? totalBearPool : totalBullPool;

        uint256 grossPayout = userStake + ((userStake * losingPool) / winningPool);
        uint256 feeAmount = ((grossPayout - userStake) * treasury.protocolFeeBps()) / 10_000;
        uint256 netPayout = grossPayout - feeAmount;

        totalClaimed += grossPayout;
        treasury.payout(msg.sender, grossPayout, feeAmount);

        emit RewardClaimed(msg.sender, grossPayout, feeAmount, netPayout);
    }

    function getBet(address user) external view returns (Bet memory) {
        return s_bets[user];
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function _isWinningBet(Side side) internal view returns (bool) {
        if (outcome == Outcome.Bull) return side == Side.Bull;
        if (outcome == Outcome.Bear) return side == Side.Bear;
        return false;
    }

    function _readValidatedFeedPrice() internal view returns (int256 answer, uint64 updatedAt) {
        (uint80 roundId, int256 observedAnswer,, uint256 observedUpdatedAt, uint80 answeredInRound) = priceFeed.latestRoundData();
        if (observedAnswer <= 0) revert OracleNegativeOrZeroPrice(observedAnswer);
        if (observedUpdatedAt == 0 || observedUpdatedAt + maxOracleDelay < block.timestamp) {
            revert OracleStale(observedUpdatedAt, block.timestamp);
        }
        if (answeredInRound < roundId) revert OracleInvalidRound();

        return (observedAnswer, uint64(observedUpdatedAt));
    }

    function _abs(int256 value) internal pure returns (uint256) {
        return value >= 0 ? uint256(value) : uint256(-value);
    }

    function _deviationBps(uint256 a, uint256 b) internal pure returns (uint256) {
        if (a == b) return 0;
        uint256 delta = a > b ? a - b : b - a;
        uint256 denominator = a > 0 ? a : 1;
        return (delta * 10_000) / denominator;
    }
}
