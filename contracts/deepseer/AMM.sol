// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IPredictionMarket {
    function getMarket(uint256 marketId)
        external
        view
        returns (
            string memory question,
            uint8 marketType,
            uint8 status,
            address creator,
            uint256 createdAt,
            uint256 resolutionTime,
            uint256 totalLiquidity,
            uint256 volume,
            string[] memory outcomes,
            uint256[] memory outcomePrices,
            address oracleSource,
            bool resolved,
            uint256 winningOutcome
        );

    function getOutcomeCount(uint256 marketId) external view returns (uint256);

    function updateMarketPrice(uint256 marketId, uint256[] memory newPrices) external;

    function updateLiquidity(uint256 marketId, uint256 newLiquidity) external;

    function recordTrade(
        uint256 marketId,
        address trader,
        uint256 outcome,
        uint256 amount,
        uint256 price,
        bool isBuy
    ) external;
}

contract AMM {
    struct LiquidityDepth {
        uint256 price;
        uint256 buyDepth;
        uint256 sellDepth;
    }

    IPredictionMarket public immutable predictionMarket;
    address public owner;

    mapping(uint256 => uint256[]) private marketPrices;
    mapping(uint256 => uint256) private marketLiquidity;
    mapping(uint256 => mapping(address => uint256)) public lpBalances;

    event TradeExecuted(
        uint256 indexed marketId,
        address indexed trader,
        uint256 outcome,
        bool isBuy,
        uint256 amount,
        uint256 price,
        uint256 timestamp
    );

    event LiquidityAdded(
        uint256 indexed marketId,
        address indexed provider,
        uint256 amount,
        uint256 timestamp
    );

    event LiquidityRemoved(
        uint256 indexed marketId,
        address indexed provider,
        uint256 amount,
        uint256 timestamp
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "ONLY_OWNER");
        _;
    }

    constructor(address predictionMarketAddress) {
        require(predictionMarketAddress != address(0), "INVALID_PM");
        predictionMarket = IPredictionMarket(predictionMarketAddress);
        owner = msg.sender;
    }

    function buy(
        uint256 marketId,
        uint256 outcome,
        uint256 amount,
        uint256 maxPrice
    ) external returns (uint256 shares) {
        require(amount > 0, "AMOUNT_REQUIRED");
        _ensureMarketInitialized(marketId);
        require(outcome < marketPrices[marketId].length, "OUTCOME_NOT_FOUND");

        uint256 executionPrice = marketPrices[marketId][outcome];
        if (maxPrice != 0) {
            require(executionPrice <= maxPrice, "SLIPPAGE_TOO_HIGH");
        }

        shares = amount;

        uint256 addedLiquidity = (amount / 5) + 1;
        marketLiquidity[marketId] += addedLiquidity;

        _shiftPrice(marketId, outcome, true, amount);
        predictionMarket.recordTrade(marketId, msg.sender, outcome, amount, executionPrice, true);
        predictionMarket.updateMarketPrice(marketId, _copyPrices(marketId));
        predictionMarket.updateLiquidity(marketId, marketLiquidity[marketId]);

        emit TradeExecuted(marketId, msg.sender, outcome, true, amount, executionPrice, block.timestamp);
    }

    function sell(
        uint256 marketId,
        uint256 outcome,
        uint256 shares,
        uint256 minPrice
    ) external returns (uint256 amount) {
        require(shares > 0, "SHARES_REQUIRED");
        _ensureMarketInitialized(marketId);
        require(outcome < marketPrices[marketId].length, "OUTCOME_NOT_FOUND");

        uint256 executionPrice = marketPrices[marketId][outcome];
        if (minPrice != 0) {
            require(executionPrice >= minPrice, "SLIPPAGE_TOO_HIGH");
        }

        amount = shares;

        if (marketLiquidity[marketId] > amount) {
            marketLiquidity[marketId] -= amount;
        } else {
            marketLiquidity[marketId] = 0;
        }

        _shiftPrice(marketId, outcome, false, shares);
        predictionMarket.recordTrade(marketId, msg.sender, outcome, shares, executionPrice, false);
        predictionMarket.updateMarketPrice(marketId, _copyPrices(marketId));
        predictionMarket.updateLiquidity(marketId, marketLiquidity[marketId]);

        emit TradeExecuted(marketId, msg.sender, outcome, false, shares, executionPrice, block.timestamp);
    }

    function addLiquidity(uint256 marketId, uint256 amount) external returns (uint256 lpTokens) {
        require(amount > 0, "AMOUNT_REQUIRED");
        _ensureMarketInitialized(marketId);

        lpTokens = amount;
        marketLiquidity[marketId] += amount;
        lpBalances[marketId][msg.sender] += lpTokens;

        predictionMarket.updateLiquidity(marketId, marketLiquidity[marketId]);
        emit LiquidityAdded(marketId, msg.sender, amount, block.timestamp);
    }

    function removeLiquidity(uint256 marketId, uint256 lpTokens) external returns (uint256 amount) {
        require(lpTokens > 0, "TOKENS_REQUIRED");
        require(lpBalances[marketId][msg.sender] >= lpTokens, "INSUFFICIENT_LP");

        amount = lpTokens;
        lpBalances[marketId][msg.sender] -= lpTokens;

        if (marketLiquidity[marketId] > amount) {
            marketLiquidity[marketId] -= amount;
        } else {
            marketLiquidity[marketId] = 0;
        }

        predictionMarket.updateLiquidity(marketId, marketLiquidity[marketId]);
        emit LiquidityRemoved(marketId, msg.sender, amount, block.timestamp);
    }

    function getPrice(uint256 marketId, uint256 outcome) external view returns (uint256) {
        if (marketPrices[marketId].length == 0) {
            uint256[] memory defaults = _defaultPricesForMarket(marketId);
            require(outcome < defaults.length, "OUTCOME_NOT_FOUND");
            return defaults[outcome];
        }

        require(outcome < marketPrices[marketId].length, "OUTCOME_NOT_FOUND");
        return marketPrices[marketId][outcome];
    }

    function getPrices(uint256 marketId) external view returns (uint256[] memory) {
        if (marketPrices[marketId].length == 0) {
            return _defaultPricesForMarket(marketId);
        }
        return _copyPrices(marketId);
    }

    function getSlippage(
        uint256,
        uint256,
        uint256 amount
    ) external pure returns (uint256) {
        return amount / 1000;
    }

    function getLiquidity(uint256 marketId) external view returns (uint256) {
        return marketLiquidity[marketId];
    }

    function getLiquidityDepth(uint256 marketId) external view returns (LiquidityDepth[] memory) {
        uint256[] memory prices = marketPrices[marketId].length == 0
            ? _defaultPricesForMarket(marketId)
            : _copyPrices(marketId);

        LiquidityDepth[] memory depth = new LiquidityDepth[](prices.length);
        uint256 liq = marketLiquidity[marketId];

        for (uint256 i = 0; i < prices.length; i++) {
            depth[i] = LiquidityDepth({
                price: prices[i],
                buyDepth: liq / (i + 2),
                sellDepth: liq / (i + 3)
            });
        }

        return depth;
    }

    // Owner helper for local development.
    function seedPrices(uint256 marketId, uint256[] calldata prices) external onlyOwner {
        require(prices.length > 1, "INVALID_PRICES");
        uint256 total = 0;
        for (uint256 i = 0; i < prices.length; i++) {
            total += prices[i];
        }
        require(total == 10000, "TOTAL_MUST_BE_10000");

        delete marketPrices[marketId];
        for (uint256 i = 0; i < prices.length; i++) {
            marketPrices[marketId].push(prices[i]);
        }

        predictionMarket.updateMarketPrice(marketId, _copyPrices(marketId));
    }

    function _ensureMarketInitialized(uint256 marketId) internal {
        if (marketPrices[marketId].length != 0) {
            return;
        }

        uint256[] memory defaults = _defaultPricesForMarket(marketId);
        for (uint256 i = 0; i < defaults.length; i++) {
            marketPrices[marketId].push(defaults[i]);
        }
    }

    function _defaultPricesForMarket(uint256 marketId) internal view returns (uint256[] memory) {
        uint256 outcomesCount = predictionMarket.getOutcomeCount(marketId);
        if (outcomesCount < 2) {
            outcomesCount = 2;
        }

        uint256[] memory defaults = new uint256[](outcomesCount);
        uint256 base = 10000 / outcomesCount;
        uint256 remainder = 10000 - (base * outcomesCount);

        for (uint256 i = 0; i < outcomesCount; i++) {
            defaults[i] = base;
        }
        defaults[0] += remainder;

        return defaults;
    }

    function _copyPrices(uint256 marketId) internal view returns (uint256[] memory) {
        uint256 len = marketPrices[marketId].length;
        uint256[] memory copied = new uint256[](len);
        for (uint256 i = 0; i < len; i++) {
            copied[i] = marketPrices[marketId][i];
        }
        return copied;
    }

    function _shiftPrice(
        uint256 marketId,
        uint256 outcome,
        bool isBuy,
        uint256 amount
    ) internal {
        uint256[] storage prices = marketPrices[marketId];
        uint256 step = (amount / 1e16) + 1;
        if (step > 800) {
            step = 800;
        }

        if (prices.length == 2) {
            uint256 other = outcome == 0 ? 1 : 0;
            uint256 current = prices[outcome];
            uint256 updated;

            if (isBuy) {
                updated = current + step;
                if (updated > 9500) {
                    updated = 9500;
                }
            } else {
                if (current > step) {
                    updated = current - step;
                } else {
                    updated = 500;
                }
                if (updated < 500) {
                    updated = 500;
                }
            }

            prices[outcome] = updated;
            prices[other] = 10000 - updated;
            return;
        }

        uint256 currentMulti = prices[outcome];
        if (isBuy) {
            uint256 increased = currentMulti + step;
            prices[outcome] = increased > 9900 ? 9900 : increased;
        } else {
            if (currentMulti > step) {
                prices[outcome] = currentMulti - step;
            } else {
                prices[outcome] = 100;
            }
        }
    }
}
