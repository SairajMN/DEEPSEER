// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract PredictionMarket {
    struct Market {
        string question;
        uint8 marketType;
        uint8 status;
        address creator;
        uint256 createdAt;
        uint256 resolutionTime;
        uint256 totalLiquidity;
        uint256 volume;
        string[] outcomes;
        uint256[] outcomePrices;
        address oracleSource;
        bool resolved;
        uint256 winningOutcome;
    }

    struct Position {
        uint256 marketId;
        uint256 outcome;
        uint256 shares;
        uint256 avgPrice;
    }

    address public owner;
    address public amm;
    address public settlementEngine;

    Market[] private markets;
    mapping(address => Position[]) private userPositions;

    event MarketCreated(uint256 indexed marketId, address indexed creator, string question, uint8 marketType);
    event MarketResolved(uint256 indexed marketId, uint256 winningOutcome, uint256 timestamp);

    modifier onlyOwner() {
        require(msg.sender == owner, "ONLY_OWNER");
        _;
    }

    modifier onlyAMM() {
        require(msg.sender == amm, "ONLY_AMM");
        _;
    }

    modifier onlySettlementEngine() {
        require(msg.sender == settlementEngine, "ONLY_SETTLEMENT");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function setAMM(address ammAddress) external onlyOwner {
        require(ammAddress != address(0), "INVALID_AMM");
        amm = ammAddress;
    }

    function setSettlementEngine(address settlementAddress) external onlyOwner {
        require(settlementAddress != address(0), "INVALID_SETTLEMENT");
        settlementEngine = settlementAddress;
    }

    function createMarket(
        string calldata question,
        uint8 marketType,
        string[] calldata outcomes,
        uint256 resolutionTime,
        address oracleSource,
        uint256 initialLiquidity
    ) external returns (uint256) {
        require(outcomes.length > 1, "NEED_MULTIPLE_OUTCOMES");

        uint256[] memory initialPrices = _initialPrices(outcomes.length);
        markets.push(
            Market({
                question: question,
                marketType: marketType,
                status: 0,
                creator: msg.sender,
                createdAt: block.timestamp,
                resolutionTime: resolutionTime,
                totalLiquidity: initialLiquidity,
                volume: 0,
                outcomes: outcomes,
                outcomePrices: initialPrices,
                oracleSource: oracleSource,
                resolved: false,
                winningOutcome: 0
            })
        );

        uint256 marketId = markets.length - 1;
        emit MarketCreated(marketId, msg.sender, question, marketType);
        return marketId;
    }

    function getMarket(uint256 marketId) external view returns (Market memory) {
        require(marketId < markets.length, "MARKET_NOT_FOUND");
        return markets[marketId];
    }

    function getMarketCount() external view returns (uint256) {
        return markets.length;
    }

    function getOutcomeCount(uint256 marketId) external view returns (uint256) {
        require(marketId < markets.length, "MARKET_NOT_FOUND");
        return markets[marketId].outcomes.length;
    }

    function getActiveMarkets() external view returns (uint256[] memory) {
        uint256 activeCount = 0;
        uint256 i;

        for (i = 0; i < markets.length; i++) {
            if (markets[i].status == 0 && !markets[i].resolved) {
                activeCount++;
            }
        }

        uint256[] memory activeIds = new uint256[](activeCount);
        uint256 index = 0;
        for (i = 0; i < markets.length; i++) {
            if (markets[i].status == 0 && !markets[i].resolved) {
                activeIds[index] = i;
                index++;
            }
        }

        return activeIds;
    }

    function getUserPositions(address user) external view returns (Position[] memory) {
        return userPositions[user];
    }

    function recordTrade(
        uint256 marketId,
        address trader,
        uint256 outcome,
        uint256 amount,
        uint256 price,
        bool isBuy
    ) external onlyAMM {
        require(marketId < markets.length, "MARKET_NOT_FOUND");
        require(outcome < markets[marketId].outcomes.length, "OUTCOME_NOT_FOUND");

        Market storage market = markets[marketId];
        market.volume += amount;

        if (isBuy) {
            _upsertPosition(trader, marketId, outcome, amount, price);
        } else {
            _decreasePosition(trader, marketId, outcome, amount);
        }
    }

    function updateMarketPrice(uint256 marketId, uint256[] memory newPrices) external onlyAMM {
        require(marketId < markets.length, "MARKET_NOT_FOUND");
        markets[marketId].outcomePrices = newPrices;
    }

    function updateLiquidity(uint256 marketId, uint256 newLiquidity) external onlyAMM {
        require(marketId < markets.length, "MARKET_NOT_FOUND");
        markets[marketId].totalLiquidity = newLiquidity;
    }

    function resolveMarket(uint256 marketId, uint256 winningOutcome) external onlySettlementEngine {
        require(marketId < markets.length, "MARKET_NOT_FOUND");
        Market storage market = markets[marketId];
        require(!market.resolved, "ALREADY_RESOLVED");
        require(winningOutcome < market.outcomes.length, "OUTCOME_NOT_FOUND");

        market.status = 2;
        market.resolved = true;
        market.winningOutcome = winningOutcome;

        emit MarketResolved(marketId, winningOutcome, block.timestamp);
    }

    function _initialPrices(uint256 outcomesCount) internal pure returns (uint256[] memory) {
        uint256[] memory prices = new uint256[](outcomesCount);
        uint256 base = 10000 / outcomesCount;
        uint256 remainder = 10000 - (base * outcomesCount);

        for (uint256 i = 0; i < outcomesCount; i++) {
            prices[i] = base;
        }
        prices[0] += remainder;

        return prices;
    }

    function _upsertPosition(
        address trader,
        uint256 marketId,
        uint256 outcome,
        uint256 amount,
        uint256 price
    ) internal {
        Position[] storage positions = userPositions[trader];

        for (uint256 i = 0; i < positions.length; i++) {
            Position storage existing = positions[i];
            if (existing.marketId == marketId && existing.outcome == outcome) {
                uint256 prevShares = existing.shares;
                uint256 newShares = prevShares + amount;

                if (newShares == 0) {
                    existing.avgPrice = 0;
                } else {
                    existing.avgPrice = ((existing.avgPrice * prevShares) + (price * amount)) / newShares;
                }
                existing.shares = newShares;
                return;
            }
        }

        positions.push(
            Position({
                marketId: marketId,
                outcome: outcome,
                shares: amount,
                avgPrice: price
            })
        );
    }

    function _decreasePosition(address trader, uint256 marketId, uint256 outcome, uint256 amount) internal {
        Position[] storage positions = userPositions[trader];

        for (uint256 i = 0; i < positions.length; i++) {
            Position storage existing = positions[i];
            if (existing.marketId == marketId && existing.outcome == outcome) {
                if (amount >= existing.shares) {
                    existing.shares = 0;
                    existing.avgPrice = 0;
                } else {
                    existing.shares -= amount;
                }
                return;
            }
        }
    }
}
