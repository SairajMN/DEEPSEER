// DeepSeer Contract ABIs — Minimal interfaces for frontend interaction
// These must match the deployed contract interfaces exactly

export const PREDICTION_MARKET_ABI = [
  "function getMarket(uint256 marketId) view returns (tuple(string question, uint8 marketType, uint8 status, address creator, uint256 createdAt, uint256 resolutionTime, uint256 totalLiquidity, uint256 volume, string[] outcomes, uint256[] outcomePrices, address oracleSource, bool resolved, uint256 winningOutcome))",
  "function getMarketCount() view returns (uint256)",
  "function getActiveMarkets() view returns (uint256[])",
  "function createMarket(string question, uint8 marketType, string[] outcomes, uint256 resolutionTime, address oracleSource, uint256 initialLiquidity) returns (uint256)",
  "function getUserPositions(address user) view returns (tuple(uint256 marketId, uint256 outcome, uint256 shares, uint256 avgPrice)[])",
  "event MarketCreated(uint256 indexed marketId, address indexed creator, string question, uint8 marketType)",
  "event MarketResolved(uint256 indexed marketId, uint256 winningOutcome, uint256 timestamp)",
] as const;

export const AMM_ABI = [
  "function buy(uint256 marketId, uint256 outcome, uint256 amount, uint256 maxPrice) returns (uint256 shares)",
  "function sell(uint256 marketId, uint256 outcome, uint256 shares, uint256 minPrice) returns (uint256 amount)",
  "function addLiquidity(uint256 marketId, uint256 amount) returns (uint256 lpTokens)",
  "function removeLiquidity(uint256 marketId, uint256 lpTokens) returns (uint256 amount)",
  "function getPrice(uint256 marketId, uint256 outcome) view returns (uint256)",
  "function getPrices(uint256 marketId) view returns (uint256[])",
  "function getSlippage(uint256 marketId, uint256 outcome, uint256 amount) view returns (uint256)",
  "function getLiquidity(uint256 marketId) view returns (uint256)",
  "function getLiquidityDepth(uint256 marketId) view returns (tuple(uint256 price, uint256 buyDepth, uint256 sellDepth)[])",
  "event TradeExecuted(uint256 indexed marketId, address indexed trader, uint256 outcome, bool isBuy, uint256 amount, uint256 price, uint256 timestamp)",
  "event LiquidityAdded(uint256 indexed marketId, address indexed provider, uint256 amount, uint256 timestamp)",
  "event LiquidityRemoved(uint256 indexed marketId, address indexed provider, uint256 amount, uint256 timestamp)",
] as const;

export const SETTLEMENT_ENGINE_ABI = [
  "function settleMarket(uint256 marketId) returns (bool)",
  "function claimWinnings(uint256 marketId) returns (uint256)",
  "function getSettlementStatus(uint256 marketId) view returns (uint8 status, uint256 oracleValue, uint256 timestamp)",
  "event OracleUpdated(uint256 indexed marketId, uint256 value, uint256 roundId, uint256 timestamp)",
  "event SettlementCompleted(uint256 indexed marketId, uint256 winningOutcome, uint256 timestamp)",
] as const;

export const GOVERNANCE_ABI = [
  "function propose(string description, bytes calldata) returns (uint256)",
  "function vote(uint256 proposalId, bool support) returns (bool)",
  "function execute(uint256 proposalId) returns (bool)",
  "function getProposal(uint256 proposalId) view returns (tuple(address proposer, string description, uint8 status, uint256 forVotes, uint256 againstVotes, uint256 startBlock, uint256 endBlock, bool executed))",
  "function getProposalCount() view returns (uint256)",
  "function getVotingPower(address account) view returns (uint256)",
  "function getLockedTokens(address account) view returns (uint256)",
  "event ProposalCreated(uint256 indexed proposalId, address indexed proposer, string description)",
  "event VoteCast(uint256 indexed proposalId, address indexed voter, bool support, uint256 weight)",
  "event ProposalExecuted(uint256 indexed proposalId)",
] as const;

export const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
] as const;
