const fs = require("fs");
const path = require("path");

const PREDICTION_MARKET_BACKEND_ABI_FALLBACK = [
  "function getMarketCount() view returns (uint256)",
  "function getMarket(uint256 marketId) view returns (tuple(string question, uint8 marketType, uint8 status, address creator, uint256 createdAt, uint256 resolutionTime, uint256 totalLiquidity, uint256 volume, string[] outcomes, uint256[] outcomePrices, address oracleSource, bool resolved, uint256 winningOutcome))",
  "event MarketResolved(uint256 indexed marketId, uint256 winningOutcome, uint256 timestamp)",
];

const AMM_BACKEND_ABI_FALLBACK = [
  "function getPrices(uint256 marketId) view returns (uint256[])",
  "function getLiquidityDepth(uint256 marketId) view returns (tuple(uint256 price, uint256 buyDepth, uint256 sellDepth)[])",
  "event TradeExecuted(uint256 indexed marketId, address indexed trader, uint256 outcome, bool isBuy, uint256 amount, uint256 price, uint256 timestamp)",
  "event LiquidityAdded(uint256 indexed marketId, address indexed provider, uint256 amount, uint256 timestamp)",
  "event LiquidityRemoved(uint256 indexed marketId, address indexed provider, uint256 amount, uint256 timestamp)",
];

const SETTLEMENT_ENGINE_BACKEND_ABI_FALLBACK = [
  "function getSettlementStatus(uint256 marketId) view returns (uint8 status, uint256 oracleValue, uint256 timestamp)",
  "event OracleUpdated(uint256 indexed marketId, uint256 value, uint256 roundId, uint256 timestamp)",
  "event SettlementCompleted(uint256 indexed marketId, uint256 winningOutcome, uint256 timestamp)",
];

const GOVERNANCE_BACKEND_ABI_FALLBACK = [
  "function getProposalCount() view returns (uint256)",
  "function getProposal(uint256 proposalId) view returns (tuple(address proposer, string description, uint8 status, uint256 forVotes, uint256 againstVotes, uint256 startBlock, uint256 endBlock, bool executed))",
  "event ProposalCreated(uint256 indexed proposalId, address indexed proposer, string description)",
  "event VoteCast(uint256 indexed proposalId, address indexed voter, bool support, uint256 weight)",
  "event ProposalExecuted(uint256 indexed proposalId)",
];

function loadFoundryAbi(contractName, fallbackAbi) {
  const artifactPath = path.resolve(
    process.cwd(),
    "out-foundry",
    `${contractName}.sol`,
    `${contractName}.json`
  );

  if (!fs.existsSync(artifactPath)) {
    return fallbackAbi;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    if (Array.isArray(parsed.abi) && parsed.abi.length > 0) {
      return parsed.abi;
    }
  } catch (error) {
    console.warn(`Failed to parse Foundry ABI for ${contractName}: ${error.message}`);
  }

  return fallbackAbi;
}

const PREDICTION_MARKET_BACKEND_ABI = loadFoundryAbi(
  "PredictionMarket",
  PREDICTION_MARKET_BACKEND_ABI_FALLBACK
);
const AMM_BACKEND_ABI = loadFoundryAbi("AMM", AMM_BACKEND_ABI_FALLBACK);
const SETTLEMENT_ENGINE_BACKEND_ABI = loadFoundryAbi(
  "SettlementEngine",
  SETTLEMENT_ENGINE_BACKEND_ABI_FALLBACK
);
const GOVERNANCE_BACKEND_ABI = loadFoundryAbi("Governance", GOVERNANCE_BACKEND_ABI_FALLBACK);

module.exports = {
  PREDICTION_MARKET_BACKEND_ABI,
  AMM_BACKEND_ABI,
  SETTLEMENT_ENGINE_BACKEND_ABI,
  GOVERNANCE_BACKEND_ABI,
};
