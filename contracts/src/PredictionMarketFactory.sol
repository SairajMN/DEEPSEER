// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {PredictionMarket} from "./PredictionMarket.sol";
import {Treasury} from "./Treasury.sol";
import {ISettlementEngineRegistry} from "./interfaces/ISettlementEngineRegistry.sol";

contract PredictionMarketFactory is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant CREATOR_ROLE = keccak256("CREATOR_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    error InvalidAddress();
    error InvalidQuestion();
    error InvalidSchedule(uint64 lockTimestamp, uint64 expiryTimestamp, uint64 nowTimestamp);

    event MarketCreated(
        uint256 indexed marketId,
        address indexed market,
        address indexed priceFeed,
        uint64 lockTimestamp,
        uint64 expiryTimestamp,
        string marketQuestion
    );

    struct MarketCreationParams {
        string marketQuestion;
        address priceFeed;
        uint64 lockTimestamp;
        uint64 expiryTimestamp;
        uint64 maxOracleDelay;
        uint32 minBetLeadTime;
        uint128 minBetAmount;
        uint16 minConfidenceScore;
        uint16 minSourceConsensus;
        uint16 maxExternalDeviationBps;
    }

    Treasury public immutable treasury;
    ISettlementEngineRegistry public immutable settlementEngine;
    address public immutable marketPauser;

    address[] public allMarkets;

    constructor(address admin, address creator, address pauser, address treasury_, address settlementEngine_) {
        if (
            admin == address(0) || creator == address(0) || pauser == address(0) || treasury_ == address(0)
                || settlementEngine_ == address(0)
        ) revert InvalidAddress();

        treasury = Treasury(treasury_);
        settlementEngine = ISettlementEngineRegistry(settlementEngine_);
        marketPauser = pauser;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(CREATOR_ROLE, creator);
        _grantRole(PAUSER_ROLE, pauser);
    }

    function createMarket(MarketCreationParams calldata params)
        external
        nonReentrant
        whenNotPaused
        onlyRole(CREATOR_ROLE)
        returns (address market)
    {
        if (bytes(params.marketQuestion).length == 0) revert InvalidQuestion();
        if (params.priceFeed == address(0)) revert InvalidAddress();
        if (params.lockTimestamp <= block.timestamp || params.expiryTimestamp <= params.lockTimestamp) {
            revert InvalidSchedule(params.lockTimestamp, params.expiryTimestamp, uint64(block.timestamp));
        }

        PredictionMarket.InitParams memory initParams = PredictionMarket.InitParams({
            admin: msg.sender,
            pauser: marketPauser,
            settlementEngine: address(settlementEngine),
            treasury: address(treasury),
            priceFeed: params.priceFeed,
            marketQuestion: params.marketQuestion,
            lockTimestamp: params.lockTimestamp,
            expiryTimestamp: params.expiryTimestamp,
            maxOracleDelay: params.maxOracleDelay,
            minBetLeadTime: params.minBetLeadTime,
            minBetAmount: params.minBetAmount,
            minConfidenceScore: params.minConfidenceScore,
            minSourceConsensus: params.minSourceConsensus,
            maxExternalDeviationBps: params.maxExternalDeviationBps
        });

        PredictionMarket deployed = new PredictionMarket(initParams);
        market = address(deployed);
        allMarkets.push(market);

        treasury.addMarket(market);
        settlementEngine.registerMarket(market);

        emit MarketCreated(
            allMarkets.length - 1,
            market,
            params.priceFeed,
            params.lockTimestamp,
            params.expiryTimestamp,
            params.marketQuestion
        );
    }

    function marketsLength() external view returns (uint256) {
        return allMarkets.length;
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
