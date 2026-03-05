// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {PredictionMarketFactory} from "../src/PredictionMarketFactory.sol";

contract CreateMarket is Script {
    error InvalidQuestion();
    error InvalidTimingConfig();

    struct CreateMarketConfig {
        uint256 deployerPrivateKey;
        address factory;
        string marketQuestion;
        address priceFeed;
        uint64 lockDelaySeconds;
        uint64 expiryDelaySeconds;
        uint64 maxOracleDelaySeconds;
        uint32 minBetLeadTimeSeconds;
        uint128 minBetAmount;
        uint16 minConfidenceScore;
        uint16 minSourceConsensus;
        uint16 maxExternalDeviationBps;
    }

    function run() external returns (address market) {
        CreateMarketConfig memory cfg = _loadConfig();

        if (bytes(cfg.marketQuestion).length == 0) revert InvalidQuestion();
        if (cfg.lockDelaySeconds <= cfg.minBetLeadTimeSeconds || cfg.expiryDelaySeconds <= cfg.lockDelaySeconds) {
            revert InvalidTimingConfig();
        }

        uint64 lockTimestamp = uint64(block.timestamp + cfg.lockDelaySeconds);
        uint64 expiryTimestamp = uint64(block.timestamp + cfg.expiryDelaySeconds);

        PredictionMarketFactory.MarketCreationParams memory params = PredictionMarketFactory.MarketCreationParams({
            marketQuestion: cfg.marketQuestion,
            priceFeed: cfg.priceFeed,
            lockTimestamp: lockTimestamp,
            expiryTimestamp: expiryTimestamp,
            maxOracleDelay: cfg.maxOracleDelaySeconds,
            minBetLeadTime: cfg.minBetLeadTimeSeconds,
            minBetAmount: cfg.minBetAmount,
            minConfidenceScore: cfg.minConfidenceScore,
            minSourceConsensus: cfg.minSourceConsensus,
            maxExternalDeviationBps: cfg.maxExternalDeviationBps
        });

        vm.startBroadcast(cfg.deployerPrivateKey);
        market = PredictionMarketFactory(cfg.factory).createMarket(params);
        vm.stopBroadcast();

        console2.log("PredictionMarketFactory:", cfg.factory);
        console2.log("New PredictionMarket:", market);
        console2.log("Price feed:", cfg.priceFeed);
        console2.log("Lock timestamp:", lockTimestamp);
        console2.log("Expiry timestamp:", expiryTimestamp);
    }

    function _loadConfig() internal view returns (CreateMarketConfig memory cfg) {
        cfg.deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        cfg.factory = vm.envAddress("PREDICTION_MARKET_FACTORY_ADDRESS");
        cfg.marketQuestion = vm.envString("MARKET_QUESTION");
        cfg.priceFeed = vm.envAddress("MARKET_PRICE_FEED");

        cfg.lockDelaySeconds = uint64(vm.envOr("MARKET_LOCK_DELAY_SECONDS", uint256(300)));
        cfg.expiryDelaySeconds = uint64(vm.envOr("MARKET_EXPIRY_DELAY_SECONDS", uint256(900)));
        cfg.maxOracleDelaySeconds = uint64(vm.envOr("MARKET_MAX_ORACLE_DELAY_SECONDS", uint256(1800)));
        cfg.minBetLeadTimeSeconds = uint32(vm.envOr("MARKET_MIN_BET_LEAD_TIME_SECONDS", uint256(30)));
        cfg.minBetAmount = uint128(vm.envOr("MARKET_MIN_BET_AMOUNT", uint256(1_000_000)));
        cfg.minConfidenceScore = uint16(vm.envOr("MARKET_MIN_CONFIDENCE_SCORE", uint256(7000)));
        cfg.minSourceConsensus = uint16(vm.envOr("MARKET_MIN_SOURCE_CONSENSUS", uint256(7000)));
        cfg.maxExternalDeviationBps = uint16(vm.envOr("MARKET_MAX_EXTERNAL_DEVIATION_BPS", uint256(300)));
    }
}

