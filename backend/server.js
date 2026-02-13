
const fs = require("fs");
const path = require("path");
const http = require("http");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { WebSocketServer, WebSocket } = require("ws");
const { ethers } = require("ethers");
const {
  PREDICTION_MARKET_BACKEND_ABI,
  AMM_BACKEND_ABI,
  SETTLEMENT_ENGINE_BACKEND_ABI,
  GOVERNANCE_BACKEND_ABI,
} = require("./abi");

dotenv.config({ path: path.resolve(process.cwd(), ".env"), quiet: true });
dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), quiet: true, override: true });

const PORT = Number(process.env.PORT || 4000);
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "";
const WS_RPC_URL = process.env.NEXT_PUBLIC_WS_RPC_URL || "";
const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 11155111);
const LOG_LOOKBACK_BLOCKS = Number(process.env.BACKEND_LOG_LOOKBACK_BLOCKS || 200_000);
const SYNC_INTERVAL_MS = Number(process.env.BACKEND_SYNC_INTERVAL_MS || 15_000);
const LISTENER_POLL_INTERVAL_MS = Math.max(
  5_000,
  Number(process.env.BACKEND_LISTENER_POLL_INTERVAL_MS || 15_000)
);
const RATE_LIMIT_WARN_COOLDOWN_MS = Math.max(
  5_000,
  Number(process.env.BACKEND_RATE_LIMIT_WARN_COOLDOWN_MS || 30_000)
);
const RISK_RECOMPUTE_DEBOUNCE_MS = 400;
const MAX_TRADE_HISTORY_PER_MARKET = 2_500;
const MAX_LIQUIDITY_EVENTS_PER_MARKET = 1_000;
const MAX_ORACLE_EVENTS_PER_MARKET = 1_000;

const CHAIN_NAME_BY_ID = {
  31337: "anvil",
  11155111: "sepolia",
};

function readFoundryDeployment(chainId) {
  const runLatestPath = path.resolve(
    process.cwd(),
    "broadcast",
    "DeployDeepseer.s.sol",
    String(chainId),
    "run-latest.json"
  );

  if (!fs.existsSync(runLatestPath)) {
    return {};
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(runLatestPath, "utf8"));
    const addresses = {};

    for (const tx of parsed.transactions || []) {
      if (tx?.transactionType !== "CREATE" || !tx.contractName || !tx.contractAddress) {
        continue;
      }

      if (tx.contractName === "PredictionMarket") {
        addresses.predictionMarket = tx.contractAddress;
      } else if (tx.contractName === "AMM") {
        addresses.amm = tx.contractAddress;
      } else if (tx.contractName === "SettlementEngine") {
        addresses.settlementEngine = tx.contractAddress;
      } else if (tx.contractName === "Governance") {
        addresses.governance = tx.contractAddress;
      } else if (tx.contractName === "DeepSeerToken") {
        addresses.token = tx.contractAddress;
      }
    }

    return addresses;
  } catch (error) {
    console.warn(`Could not parse Foundry deployment file: ${error.message}`);
    return {};
  }
}

function readDeploymentSnapshot() {
  const deploymentPath = path.resolve(process.cwd(), "backend", "deployment.json");
  if (!fs.existsSync(deploymentPath)) {
    return {};
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    return parsed.contracts || {};
  } catch (error) {
    console.warn(`Could not parse backend/deployment.json: ${error.message}`);
    return {};
  }
}

function resolveAddresses() {
  const deploymentSnapshot = readDeploymentSnapshot();
  const foundryDeployment = readFoundryDeployment(CHAIN_ID);

  return {
    predictionMarket:
      process.env.NEXT_PUBLIC_PREDICTION_MARKET_ADDRESS ||
      deploymentSnapshot.predictionMarket ||
      foundryDeployment.predictionMarket ||
      "",
    amm:
      process.env.NEXT_PUBLIC_AMM_ADDRESS ||
      deploymentSnapshot.amm ||
      foundryDeployment.amm ||
      "",
    settlementEngine:
      process.env.NEXT_PUBLIC_SETTLEMENT_ENGINE_ADDRESS ||
      deploymentSnapshot.settlementEngine ||
      foundryDeployment.settlementEngine ||
      "",
    governance:
      process.env.NEXT_PUBLIC_GOVERNANCE_ADDRESS ||
      deploymentSnapshot.governance ||
      foundryDeployment.governance ||
      "",
    token:
      process.env.NEXT_PUBLIC_TOKEN_ADDRESS ||
      deploymentSnapshot.token ||
      foundryDeployment.token ||
      "",
  };
}

const addresses = resolveAddresses();

const providerNetwork = {
  chainId: CHAIN_ID,
  name: CHAIN_NAME_BY_ID[CHAIN_ID] || `chain-${CHAIN_ID}`,
};

const provider = RPC_URL
  ? new ethers.JsonRpcProvider(RPC_URL, providerNetwork, { staticNetwork: true })
  : null;

const hasValidWsRpcUrl = /^wss?:\/\//i.test(WS_RPC_URL);
if (WS_RPC_URL && !hasValidWsRpcUrl) {
  console.warn("NEXT_PUBLIC_WS_RPC_URL must start with ws:// or wss://. Falling back to HTTP polling.");
}

const wsListenerProvider =
  WS_RPC_URL && hasValidWsRpcUrl
    ? new ethers.WebSocketProvider(WS_RPC_URL, providerNetwork)
    : null;
let listenerProvider = wsListenerProvider || provider;
let listenerTransport = wsListenerProvider ? "websocket" : "http-polling";

if (listenerProvider && listenerProvider === provider) {
  listenerProvider.pollingInterval = LISTENER_POLL_INTERVAL_MS;
}

const predictionMarket =
  addresses.predictionMarket && provider
    ? new ethers.Contract(addresses.predictionMarket, PREDICTION_MARKET_BACKEND_ABI, provider)
    : null;

const amm =
  addresses.amm && provider ? new ethers.Contract(addresses.amm, AMM_BACKEND_ABI, provider) : null;

const settlementEngine =
  addresses.settlementEngine && provider
    ? new ethers.Contract(addresses.settlementEngine, SETTLEMENT_ENGINE_BACKEND_ABI, provider)
    : null;

const governance =
  addresses.governance && provider
    ? new ethers.Contract(addresses.governance, GOVERNANCE_BACKEND_ABI, provider)
    : null;

function createListenerContract(address, abi) {
  if (!address || !listenerProvider) return null;
  return new ethers.Contract(address, abi, listenerProvider);
}

let predictionMarketListener = null;
let ammListener = null;
let settlementEngineListener = null;
let governanceListener = null;

function rebuildListenerContracts() {
  predictionMarketListener =
    createListenerContract(addresses.predictionMarket, PREDICTION_MARKET_BACKEND_ABI) ||
    predictionMarket;
  ammListener = createListenerContract(addresses.amm, AMM_BACKEND_ABI) || amm;
  settlementEngineListener =
    createListenerContract(addresses.settlementEngine, SETTLEMENT_ENGINE_BACKEND_ABI) ||
    settlementEngine;
  governanceListener =
    createListenerContract(addresses.governance, GOVERNANCE_BACKEND_ABI) || governance;
}

rebuildListenerContracts();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const clients = new Set();

const state = {
  markets: new Map(),
  tradeHistory: new Map(),
  liquidityHistory: new Map(),
  oracleHistory: new Map(),
  riskScores: new Map(),
  riskExplain: new Map(),
  proposalHistory: [],
  uniqueTraders: new Set(),
  indexedFromBlock: null,
};

let onchainListenersStarted = false;
let syncPromise = null;
let lastSyncAt = 0;
let lastChainStatus = null;
let lastRateLimitWarnAt = 0;
let listenerProviderErrorBinding = null;

const marketRiskTimers = new Map();

function isRateLimitedRpcError(error) {
  if (!error) return false;
  const message = [
    error?.shortMessage,
    error?.message,
    (() => {
      try {
        return JSON.stringify(error?.value || "");
      } catch {
        return "";
      }
    })(),
    (() => {
      try {
        return JSON.stringify(error?.info || "");
      } catch {
        return "";
      }
    })(),
  ]
    .filter(Boolean)
    .join(" ");

  return /too many requests|429|-32005/i.test(message);
}

function onListenerProviderError(error) {
  if (isRateLimitedRpcError(error)) {
    const now = Date.now();
    if (now - lastRateLimitWarnAt >= RATE_LIMIT_WARN_COOLDOWN_MS) {
      lastRateLimitWarnAt = now;
      console.warn(
        `Listener RPC rate-limited (${listenerTransport}). Use NEXT_PUBLIC_WS_RPC_URL or raise BACKEND_LISTENER_POLL_INTERVAL_MS.`
      );
    }
    return;
  }

  const message = error?.shortMessage || error?.message || String(error);
  console.warn(`Listener provider error (${listenerTransport}): ${message}`);
}

function bindListenerProviderErrors() {
  if (!listenerProvider || typeof listenerProvider.on !== "function") return;
  if (listenerProviderErrorBinding === listenerProvider) return;

  if (
    listenerProviderErrorBinding &&
    typeof listenerProviderErrorBinding.off === "function"
  ) {
    listenerProviderErrorBinding.off("error", onListenerProviderError);
  }

  listenerProvider.on("error", onListenerProviderError);
  listenerProviderErrorBinding = listenerProvider;
}

function fallbackListenerProviderToHttp() {
  if (!provider || listenerProvider === provider) return false;

  if (wsListenerProvider && typeof wsListenerProvider.destroy === "function") {
    try {
      wsListenerProvider.destroy();
    } catch {
      // Ignore WebSocket teardown failures.
    }
  }

  listenerProvider = provider;
  listenerTransport = "http-polling";
  listenerProvider.pollingInterval = LISTENER_POLL_INTERVAL_MS;
  rebuildListenerContracts();
  bindListenerProviderErrors();
  return true;
}

bindListenerProviderErrors();

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function toBigInt(value) {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value)) return BigInt(Math.floor(value));
  if (typeof value === "string" && value.length > 0) {
    try {
      return BigInt(value);
    } catch {
      return 0n;
    }
  }
  return 0n;
}

function toNumber(value, fallback = 0) {
  if (typeof value === "bigint") {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseStatus(value) {
  const status = toNumber(value, 0);
  if (status === 2) return "resolved";
  if (status === 1) return "resolving";
  return "active";
}

function parseMarketType(value) {
  const marketType = toNumber(value, 0);
  if (marketType === 1) return "scalar";
  if (marketType === 2) return "categorical";
  if (marketType === 3) return "conditional";
  return "binary";
}

function mapSourceStatus(contractPresent, lastFetchTs, staleAfterSec = 3600) {
  if (!contractPresent) return "offline";
  if (!lastFetchTs || lastFetchTs <= 0) return "stale";
  const age = nowSec() - lastFetchTs;
  return age <= staleAfterSec ? "active" : "stale";
}

function sumBigInt(items) {
  return items.reduce((acc, value) => acc + toBigInt(value), 0n);
}

function pushBounded(map, key, value, maxSize) {
  const arr = map.get(key) || [];
  arr.push(value);
  if (arr.length > maxSize) {
    arr.splice(0, arr.length - maxSize);
  }
  map.set(key, arr);
}
function broadcast(type, payload) {
  const message = JSON.stringify({ type, payload });
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

function parseTradePayload(marketId, trader, outcome, isBuy, amount, price, timestamp, eventLike) {
  return {
    marketId: marketId.toString(),
    trader: String(trader),
    outcome: toNumber(outcome, 0),
    side: Boolean(isBuy) ? "buy" : "sell",
    amount: toBigInt(amount).toString(),
    price: toBigInt(price).toString(),
    timestamp: toBigInt(timestamp).toString(),
    txHash: eventLike?.log?.transactionHash || eventLike?.transactionHash || "",
  };
}

function parseLiquidityPayload(
  marketId,
  providerAddress,
  amount,
  timestamp,
  eventLike,
  direction
) {
  return {
    marketId: marketId.toString(),
    provider: String(providerAddress),
    amount: toBigInt(amount).toString(),
    timestamp: toBigInt(timestamp).toString(),
    txHash: eventLike?.log?.transactionHash || eventLike?.transactionHash || "",
    direction,
  };
}

function parseOraclePayload(marketId, value, roundId, timestamp, eventLike) {
  return {
    marketId: marketId.toString(),
    value: toBigInt(value).toString(),
    roundId: toBigInt(roundId).toString(),
    timestamp: toBigInt(timestamp).toString(),
    txHash: eventLike?.log?.transactionHash || eventLike?.transactionHash || "",
  };
}

function upsertTrade(payload) {
  pushBounded(state.tradeHistory, payload.marketId, payload, MAX_TRADE_HISTORY_PER_MARKET);
  state.uniqueTraders.add(payload.trader.toLowerCase());
}

function upsertLiquidity(payload) {
  pushBounded(state.liquidityHistory, payload.marketId, payload, MAX_LIQUIDITY_EVENTS_PER_MARKET);
}

function upsertOracle(payload) {
  pushBounded(state.oracleHistory, payload.marketId, payload, MAX_ORACLE_EVENTS_PER_MARKET);
}

function computeEntropy(pricesBps) {
  if (!Array.isArray(pricesBps) || pricesBps.length < 2) return 1;
  const values = pricesBps.map((v) => Math.max(toNumber(v, 0), 0));
  const total = values.reduce((acc, v) => acc + v, 0);
  if (total <= 0) return 1;

  const entropy = values.reduce((acc, price) => {
    const p = price / total;
    if (p <= 0) return acc;
    return acc - p * Math.log(p);
  }, 0);

  const normalized = entropy / Math.log(values.length);
  return clamp01(normalized);
}

function computeVolatilityPenalty(trades) {
  if (!Array.isArray(trades) || trades.length < 3) return null;
  const sorted = [...trades].sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
  const returns = [];

  for (let i = 1; i < sorted.length; i++) {
    const prevPrice = toNumber(sorted[i - 1].price, 0) / 10000;
    const currentPrice = toNumber(sorted[i].price, 0) / 10000;
    if (prevPrice <= 0 || currentPrice <= 0) continue;
    returns.push(Math.log(currentPrice / prevPrice));
  }

  if (returns.length < 2) return null;

  const mean = returns.reduce((acc, value) => acc + value, 0) / returns.length;
  const variance =
    returns.reduce((acc, value) => acc + Math.pow(value - mean, 2), 0) / returns.length;
  const stdDev = Math.sqrt(Math.max(variance, 0));

  return clamp01(stdDev / 0.08);
}

function computeRiskForMarket(marketId) {
  const market = state.markets.get(marketId);
  if (!market) return null;

  const prices = market.outcomePrices || [];
  if (!Array.isArray(prices) || prices.length < 2) return null;

  const tradeEvents = state.tradeHistory.get(marketId) || [];
  const latestTrade = tradeEvents.length > 0 ? tradeEvents[tradeEvents.length - 1] : null;

  const oracleEvents = state.oracleHistory.get(marketId) || [];
  const latestOracle = oracleEvents.length > 0 ? oracleEvents[oracleEvents.length - 1] : null;

  const entropy = computeEntropy(prices);
  const consensus = 1 - entropy;

  const liquidityFloat = Number(ethers.formatUnits(toBigInt(market.totalLiquidity), 18));
  const volumeFloat = Number(ethers.formatUnits(toBigInt(market.volume), 18));

  const liquidityScore = clamp01(Math.log10(Math.max(liquidityFloat, 0) + 1) / 6);
  const volumeScore = clamp01(Math.log10(Math.max(volumeFloat, 0) + 1) / 7);

  const oracleTimestamp = latestOracle ? toNumber(latestOracle.timestamp, 0) : 0;
  const oracleFreshness =
    oracleTimestamp > 0 ? clamp01(1 - (nowSec() - oracleTimestamp) / 86_400) : 0;

  const volatilityPenalty = computeVolatilityPenalty(tradeEvents) ?? clamp01(entropy);

  const totalPrices = prices.reduce((acc, value) => acc + toNumber(value, 0), 0);
  let oracleAgreement = 0;
  if (latestOracle && totalPrices > 0) {
    const oracleOutcome = toNumber(latestOracle.value, -1);
    if (oracleOutcome >= 0 && oracleOutcome < prices.length) {
      oracleAgreement = toNumber(prices[oracleOutcome], 0) / totalPrices;
    }
  }

  const confidence = Math.round(
    clamp01(
      consensus * 0.3 +
        liquidityScore * 0.25 +
        volumeScore * 0.15 +
        oracleFreshness * 0.15 +
        (1 - volatilityPenalty) * 0.15
    ) * 100
  );

  const sourceAgreement = Math.round(
    clamp01(consensus * 0.65 + oracleFreshness * 0.2 + oracleAgreement * 0.15) * 100
  );

  const temporalConsistency = Math.round(
    clamp01((1 - volatilityPenalty) * 0.75 + oracleFreshness * 0.25) * 100
  );

  const anomalyFlags = [];
  if (toBigInt(market.totalLiquidity) === 0n) {
    anomalyFlags.push({
      type: "liquidity-empty",
      severity: "high",
      description: "Market liquidity is zero; price integrity is weak.",
      timestamp: nowSec().toString(),
    });
  }
  if (!latestOracle) {
    anomalyFlags.push({
      type: "oracle-awaiting-update",
      severity: "medium",
      description: "Awaiting oracle update from settlement engine.",
      timestamp: nowSec().toString(),
    });
  }
  if (latestOracle && nowSec() - toNumber(latestOracle.timestamp, 0) > 86_400) {
    anomalyFlags.push({
      type: "oracle-stale",
      severity: "medium",
      description: "Oracle signal is stale relative to market activity.",
      timestamp: nowSec().toString(),
    });
  }
  if (tradeEvents.length >= 5 && volatilityPenalty > 0.7) {
    anomalyFlags.push({
      type: "volatility-spike",
      severity: "high",
      description: "Rapid price moves detected from recent trade executions.",
      timestamp: nowSec().toString(),
    });
  }
  const resolutionTime = toNumber(market.resolutionTime, 0);
  if (!market.resolved && resolutionTime > 0 && nowSec() > resolutionTime + 3600 && !latestOracle) {
    anomalyFlags.push({
      type: "resolution-delay",
      severity: "high",
      description: "Resolution window passed but oracle update has not arrived.",
      timestamp: nowSec().toString(),
    });
  }

  const tradeLastFetch = latestTrade ? toNumber(latestTrade.timestamp, 0) : 0;
  const score = {
    marketId,
    confidenceScore: confidence,
    sourceAgreement,
    temporalConsistency,
    anomalyFlags,
    dataSources: [
      {
        name: "onchain-market-state",
        reliability: 100,
        lastFetch: nowSec().toString(),
        status: "active",
      },
      {
        name: "onchain-trades",
        reliability: tradeEvents.length > 0 ? 95 : 65,
        lastFetch: tradeLastFetch.toString(),
        status: mapSourceStatus(Boolean(amm), tradeLastFetch, 3600),
      },
      {
        name: "settlement-oracle",
        reliability: latestOracle ? 92 : 55,
        lastFetch: oracleTimestamp.toString(),
        status: mapSourceStatus(Boolean(settlementEngine), oracleTimestamp, 21_600),
      },
    ],
    lastUpdated: nowSec().toString(),
  };

  const explain = {
    marketId,
    metrics: {
      entropy,
      consensus,
      liquidityScore,
      volumeScore,
      oracleFreshness,
      volatilityPenalty,
      oracleAgreement,
    },
    latestTrade,
    latestOracle,
    generatedAt: nowSec().toString(),
  };

  state.riskExplain.set(marketId, explain);
  return score;
}

function recomputeRiskForMarket(marketId) {
  const score = computeRiskForMarket(marketId);
  if (!score) {
    state.riskScores.delete(marketId);
    state.riskExplain.delete(marketId);
    return null;
  }
  state.riskScores.set(marketId, score);
  return score;
}

function recomputeAllRisk() {
  for (const marketId of state.markets.keys()) {
    recomputeRiskForMarket(marketId);
  }
}
async function fetchMarketSnapshot(marketId) {
  if (!predictionMarket) {
    throw new Error("PredictionMarket contract is not configured.");
  }

  const raw = await predictionMarket.getMarket(marketId);
  let outcomePrices = Array.isArray(raw.outcomePrices) ? raw.outcomePrices : [];
  if (amm) {
    try {
      outcomePrices = await amm.getPrices(marketId);
    } catch {
      // Fallback to prices from PredictionMarket state.
    }
  }

  let oracleStatus = { status: 0n, oracleValue: 0n, timestamp: 0n };
  if (settlementEngine) {
    try {
      const settlement = await settlementEngine.getSettlementStatus(marketId);
      oracleStatus = {
        status: toBigInt(settlement.status),
        oracleValue: toBigInt(settlement.oracleValue),
        timestamp: toBigInt(settlement.timestamp),
      };
    } catch {
      // Ignore unavailable settlement data.
    }
  }

  return {
    id: marketId.toString(),
    question: raw.question,
    marketType: parseMarketType(raw.marketType),
    status: parseStatus(raw.status),
    creator: raw.creator,
    createdAt: toBigInt(raw.createdAt),
    resolutionTime: toBigInt(raw.resolutionTime),
    totalLiquidity: toBigInt(raw.totalLiquidity),
    volume: toBigInt(raw.volume),
    outcomes: Array.isArray(raw.outcomes) ? raw.outcomes : [],
    outcomePrices: Array.isArray(outcomePrices) ? outcomePrices.map(toBigInt) : [],
    oracleSource: raw.oracleSource,
    resolved: Boolean(raw.resolved),
    winningOutcome: toBigInt(raw.winningOutcome),
    oracleStatus,
  };
}

async function refreshAllMarkets() {
  if (!predictionMarket) {
    state.markets.clear();
    return [];
  }

  const count = Number(await predictionMarket.getMarketCount());
  const nextMap = new Map();

  for (let i = 0; i < count; i++) {
    try {
      const market = await fetchMarketSnapshot(i);
      nextMap.set(market.id, market);
    } catch (error) {
      console.warn(`Failed to fetch market ${i}: ${error.message}`);
    }
  }

  state.markets = nextMap;
  return Array.from(state.markets.values());
}

async function indexHistoricalEvents() {
  if (!provider || state.indexedFromBlock !== null) return;

  const latestBlock = await provider.getBlockNumber();
  const fromBlock = Math.max(0, latestBlock - LOG_LOOKBACK_BLOCKS);

  state.tradeHistory.clear();
  state.liquidityHistory.clear();
  state.oracleHistory.clear();
  state.uniqueTraders.clear();

  if (amm) {
    const tradeLogs = await amm.queryFilter(amm.filters.TradeExecuted(), fromBlock, latestBlock);
    for (const log of tradeLogs) {
      const payload = parseTradePayload(
        log.args?.marketId ?? log.args?.[0],
        log.args?.trader ?? log.args?.[1],
        log.args?.outcome ?? log.args?.[2],
        log.args?.isBuy ?? log.args?.[3],
        log.args?.amount ?? log.args?.[4],
        log.args?.price ?? log.args?.[5],
        log.args?.timestamp ?? log.args?.[6],
        { transactionHash: log.transactionHash }
      );
      upsertTrade(payload);
    }

    const liquidityAddLogs = await amm.queryFilter(amm.filters.LiquidityAdded(), fromBlock, latestBlock);
    for (const log of liquidityAddLogs) {
      const payload = parseLiquidityPayload(
        log.args?.marketId ?? log.args?.[0],
        log.args?.provider ?? log.args?.[1],
        log.args?.amount ?? log.args?.[2],
        log.args?.timestamp ?? log.args?.[3],
        { transactionHash: log.transactionHash },
        "add"
      );
      upsertLiquidity(payload);
    }

    const liquidityRemoveLogs = await amm.queryFilter(
      amm.filters.LiquidityRemoved(),
      fromBlock,
      latestBlock
    );
    for (const log of liquidityRemoveLogs) {
      const payload = parseLiquidityPayload(
        log.args?.marketId ?? log.args?.[0],
        log.args?.provider ?? log.args?.[1],
        log.args?.amount ?? log.args?.[2],
        log.args?.timestamp ?? log.args?.[3],
        { transactionHash: log.transactionHash },
        "remove"
      );
      upsertLiquidity(payload);
    }
  }

  if (settlementEngine) {
    const oracleLogs = await settlementEngine.queryFilter(
      settlementEngine.filters.OracleUpdated(),
      fromBlock,
      latestBlock
    );
    for (const log of oracleLogs) {
      const payload = parseOraclePayload(
        log.args?.marketId ?? log.args?.[0],
        log.args?.value ?? log.args?.[1],
        log.args?.roundId ?? log.args?.[2],
        log.args?.timestamp ?? log.args?.[3],
        { transactionHash: log.transactionHash }
      );
      upsertOracle(payload);
    }
  }

  if (governance) {
    const proposalLogs = await governance.queryFilter(
      governance.filters.ProposalCreated(),
      fromBlock,
      latestBlock
    );
    state.proposalHistory = proposalLogs.map((log) => ({
      proposalId: (log.args?.proposalId ?? log.args?.[0]).toString(),
      proposer: String(log.args?.proposer ?? log.args?.[1]),
      description: String(log.args?.description ?? log.args?.[2]),
      txHash: log.transactionHash,
      blockNumber: log.blockNumber,
    }));
  }

  state.indexedFromBlock = fromBlock;
}

async function syncLiveState(force = false) {
  if (!provider) return;

  if (syncPromise) return syncPromise;
  if (!force && Date.now() - lastSyncAt < SYNC_INTERVAL_MS) return;

  syncPromise = (async () => {
    try {
      await provider.getBlockNumber();
      if (lastChainStatus !== true) {
        console.log(`Connected to chain RPC at ${RPC_URL}`);
        lastChainStatus = true;
      }
      await indexHistoricalEvents();
      await refreshAllMarkets();
      recomputeAllRisk();
      lastSyncAt = Date.now();
    } catch (error) {
      if (lastChainStatus !== false) {
        console.warn(`Chain RPC unreachable at ${RPC_URL}.`);
        lastChainStatus = false;
      }
      throw error;
    } finally {
      syncPromise = null;
    }
  })();

  return syncPromise;
}

async function refreshMarketAndBroadcastRisk(marketId) {
  try {
    if (!predictionMarket) return;
    const market = await fetchMarketSnapshot(marketId);
    state.markets.set(market.id, market);
    const risk = recomputeRiskForMarket(market.id);
    if (risk) {
      broadcast("AIConfidenceUpdated", risk);
    }
  } catch (error) {
    console.warn(`Failed to refresh market ${marketId}: ${error.message}`);
  }
}

function scheduleRiskRecompute(marketId) {
  if (marketRiskTimers.has(marketId)) return;

  const timer = setTimeout(async () => {
    marketRiskTimers.delete(marketId);
    await refreshMarketAndBroadcastRisk(marketId);
  }, RISK_RECOMPUTE_DEBOUNCE_MS);

  marketRiskTimers.set(marketId, timer);
}
function attachOnchainListeners() {
  if (onchainListenersStarted) return;

  if (ammListener) {
    ammListener.on("TradeExecuted", (marketId, trader, outcome, isBuy, amount, price, timestamp, event) => {
      const payload = parseTradePayload(
        marketId,
        trader,
        outcome,
        isBuy,
        amount,
        price,
        timestamp,
        event
      );
      upsertTrade(payload);
      broadcast("TradeExecuted", payload);
      scheduleRiskRecompute(payload.marketId);
    });

    ammListener.on("LiquidityAdded", (marketId, providerAddress, amount, timestamp, event) => {
      const payload = parseLiquidityPayload(
        marketId,
        providerAddress,
        amount,
        timestamp,
        event,
        "add"
      );
      upsertLiquidity(payload);
      broadcast("LiquidityAdded", payload);
      scheduleRiskRecompute(payload.marketId);
    });

    ammListener.on("LiquidityRemoved", (marketId, providerAddress, amount, timestamp, event) => {
      const payload = parseLiquidityPayload(
        marketId,
        providerAddress,
        amount,
        timestamp,
        event,
        "remove"
      );
      upsertLiquidity(payload);
      broadcast("LiquidityRemoved", payload);
      scheduleRiskRecompute(payload.marketId);
    });
  }

  if (predictionMarketListener) {
    predictionMarketListener.on("MarketResolved", (marketId, winningOutcome, timestamp, event) => {
      const payload = {
        marketId: marketId.toString(),
        winningOutcome: toNumber(winningOutcome, 0),
        timestamp: toBigInt(timestamp).toString(),
        txHash: event?.log?.transactionHash || event?.transactionHash || "",
      };
      broadcast("MarketResolved", payload);
      scheduleRiskRecompute(payload.marketId);
    });
  }

  if (settlementEngineListener) {
    settlementEngineListener.on("OracleUpdated", (marketId, value, roundId, timestamp, event) => {
      const payload = parseOraclePayload(marketId, value, roundId, timestamp, event);
      upsertOracle(payload);
      broadcast("OracleUpdated", payload);
      scheduleRiskRecompute(payload.marketId);
    });

    settlementEngineListener.on(
      "SettlementCompleted",
      (marketId, winningOutcome, timestamp, event) => {
        const payload = {
          marketId: marketId.toString(),
          winningOutcome: toNumber(winningOutcome, 0),
          timestamp: toBigInt(timestamp).toString(),
          txHash: event?.log?.transactionHash || event?.transactionHash || "",
        };
        broadcast("SettlementCompleted", payload);
        scheduleRiskRecompute(payload.marketId);
      }
    );
  }

  if (governanceListener) {
    governanceListener.on("ProposalCreated", (proposalId, proposer, description, event) => {
      const payload = {
        proposalId: proposalId.toString(),
        proposer,
        description,
        txHash: event?.log?.transactionHash || event?.transactionHash || "",
        timestamp: nowSec().toString(),
      };
      state.proposalHistory.push(payload);
      broadcast("ProposalCreated", payload);
    });

    governanceListener.on("VoteCast", (proposalId, voter, support, weight, event) => {
      const payload = {
        proposalId: proposalId.toString(),
        voter,
        support: Boolean(support),
        weight: toBigInt(weight).toString(),
        txHash: event?.log?.transactionHash || event?.transactionHash || "",
        timestamp: nowSec().toString(),
      };
      broadcast("VoteCast", payload);
    });

    governanceListener.on("ProposalExecuted", (proposalId, event) => {
      const payload = {
        proposalId: proposalId.toString(),
        txHash: event?.log?.transactionHash || event?.transactionHash || "",
        timestamp: nowSec().toString(),
      };
      broadcast("ProposalExecuted", payload);
    });
  }

  onchainListenersStarted = true;
  console.log(`On-chain listeners attached via ${listenerTransport}.`);
}

async function startOnchainListenersIfReady() {
  if (onchainListenersStarted || !listenerProvider) return;

  try {
    await listenerProvider.getBlockNumber();
    attachOnchainListeners();
  } catch {
    if (listenerProvider === wsListenerProvider && fallbackListenerProviderToHttp()) {
      console.warn(
        `Listener WebSocket RPC unreachable at ${WS_RPC_URL}. Falling back to HTTP polling every ${LISTENER_POLL_INTERVAL_MS}ms.`
      );
    }
    // Retry until RPC is reachable.
  }
}

function ensureContract(contract, name, res) {
  if (contract) return true;
  res.status(503).json({ error: `${name} contract is not configured.` });
  return false;
}

function buildGlobalAnalytics() {
  const markets = Array.from(state.markets.values());
  const totalVolume = sumBigInt(markets.map((m) => m.volume));
  const totalLiquidity = sumBigInt(markets.map((m) => m.totalLiquidity));

  return {
    totalVolume: totalVolume.toString(),
    totalLiquidity: totalLiquidity.toString(),
    totalMarkets: markets.length,
    activeMarkets: markets.filter((m) => !m.resolved && m.status === "active").length,
    totalTraders: state.uniqueTraders.size,
  };
}

function buildMarketAnalytics(marketId) {
  const market = state.markets.get(marketId);
  if (!market) return null;

  const trades = state.tradeHistory.get(marketId) || [];
  const now = nowSec();
  const volume24h = sumBigInt(
    trades
      .filter((trade) => toNumber(trade.timestamp, 0) >= now - 86_400)
      .map((trade) => trade.amount)
  );

  const uniqueTraders = new Set(trades.map((trade) => trade.trader.toLowerCase())).size;

  return {
    volume24h: volume24h.toString(),
    volumeTotal: toBigInt(market.volume).toString(),
    liquidityTotal: toBigInt(market.totalLiquidity).toString(),
    tradeCount: trades.length,
    uniqueTraders,
  };
}

function buildPriceCandles(marketId, intervalSec = 300) {
  const trades = state.tradeHistory.get(marketId) || [];
  if (trades.length === 0) return [];

  const sorted = [...trades].sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
  const buckets = new Map();

  for (const trade of sorted) {
    const ts = toNumber(trade.timestamp, 0);
    if (ts <= 0) continue;

    const bucket = Math.floor(ts / intervalSec) * intervalSec;
    const price = toNumber(trade.price, 0) / 10000;
    const volume = Number(ethers.formatUnits(toBigInt(trade.amount), 18));

    if (!buckets.has(bucket)) {
      buckets.set(bucket, { time: bucket, open: price, high: price, low: price, close: price, volume });
      continue;
    }

    const candle = buckets.get(bucket);
    candle.high = Math.max(candle.high, price);
    candle.low = Math.min(candle.low, price);
    candle.close = price;
    candle.volume += volume;
  }

  return Array.from(buckets.values()).sort((a, b) => a.time - b.time);
}

function buildOraclePerformance(marketId) {
  const updates = state.oracleHistory.get(marketId) || [];
  const latest = updates.length > 0 ? updates[updates.length - 1] : null;

  const intervals = [];
  for (let i = 1; i < updates.length; i++) {
    const prev = toNumber(updates[i - 1].timestamp, 0);
    const current = toNumber(updates[i].timestamp, 0);
    if (prev > 0 && current > prev) intervals.push(current - prev);
  }

  const averageIntervalSec =
    intervals.length > 0
      ? Math.round(intervals.reduce((acc, value) => acc + value, 0) / intervals.length)
      : null;

  const stalenessSec = latest ? Math.max(0, nowSec() - toNumber(latest.timestamp, 0)) : null;

  return {
    updates,
    updateCount: updates.length,
    lastUpdate: latest?.timestamp ?? null,
    averageIntervalSec,
    stalenessSec,
  };
}

function buildRiskTimeline(marketId) {
  const tradeEvents = state.tradeHistory.get(marketId) || [];
  const oracleEvents = state.oracleHistory.get(marketId) || [];
  const risk = state.riskScores.get(marketId);
  const timeline = [];

  for (const trade of tradeEvents) {
    timeline.push({
      type: "trade",
      timestamp: trade.timestamp,
      details: { side: trade.side, price: trade.price, amount: trade.amount },
    });
  }

  for (const oracle of oracleEvents) {
    timeline.push({
      type: "oracle",
      timestamp: oracle.timestamp,
      details: { value: oracle.value, roundId: oracle.roundId },
    });
  }

  if (risk?.anomalyFlags) {
    for (const flag of risk.anomalyFlags) {
      timeline.push({
        type: "anomaly",
        timestamp: flag.timestamp,
        details: {
          anomalyType: flag.type,
          severity: flag.severity,
          description: flag.description,
        },
      });
    }
  }

  timeline.sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
  return timeline;
}
app.get("/", (_req, res) => {
  res.json({
    service: "deepseer-backend",
    ok: true,
    endpoints: [
      "/health",
      "/api/risk",
      "/api/risk/:marketId",
      "/api/risk/:marketId/explain",
      "/api/risk/:marketId/timeline",
      "/api/analytics",
      "/api/analytics/:marketId",
      "/api/analytics/:marketId/price-history",
      "/api/analytics/:marketId/depth",
      "/api/analytics/:marketId/oracle-performance",
    ],
  });
});

app.get("/favicon.ico", (_req, res) => {
  res.status(204).end();
});

app.get("/.well-known/appspecific/com.chrome.devtools.json", (_req, res) => {
  res.status(204).end();
});

app.get("/health", async (_req, res) => {
  let rpcReachable = false;
  try {
    if (provider) {
      await provider.getBlockNumber();
      rpcReachable = true;
    }
  } catch {
    rpcReachable = false;
  }

  res.json({
    ok: true,
    rpcUrl: RPC_URL || null,
    rpcReachable,
    addresses,
    predictionMarketConnected: Boolean(predictionMarket),
    ammConnected: Boolean(amm),
    settlementConnected: Boolean(settlementEngine),
    governanceConnected: Boolean(governance),
  });
});

app.get("/api/risk", async (_req, res) => {
  try {
    if (!ensureContract(predictionMarket, "PredictionMarket", res)) return;
    await syncLiveState();
    const payload = Array.from(state.riskScores.values());
    res.json(payload);
  } catch (error) {
    res.status(503).json({ error: error.message || "Failed to evaluate risk model." });
  }
});

app.get("/api/risk/:marketId", async (req, res) => {
  try {
    if (!ensureContract(predictionMarket, "PredictionMarket", res)) return;
    await syncLiveState();

    const marketId = req.params.marketId;
    if (!state.markets.has(marketId)) {
      return res.status(404).json({ error: "Market not found" });
    }

    const score = state.riskScores.get(marketId);
    if (!score) {
      return res.status(503).json({ error: "Risk model not yet evaluated" });
    }

    res.json(score);
  } catch (error) {
    res.status(503).json({ error: error.message || "Failed to evaluate risk model." });
  }
});

app.get("/api/risk/:marketId/explain", async (req, res) => {
  try {
    if (!ensureContract(predictionMarket, "PredictionMarket", res)) return;
    await syncLiveState();

    const marketId = req.params.marketId;
    if (!state.markets.has(marketId)) {
      return res.status(404).json({ error: "Market not found" });
    }

    const explain = state.riskExplain.get(marketId);
    if (!explain) {
      return res.status(503).json({ error: "Risk model not yet evaluated" });
    }

    res.json(explain);
  } catch (error) {
    res.status(503).json({ error: error.message || "Failed to fetch risk explanation." });
  }
});

app.get("/api/risk/:marketId/timeline", async (req, res) => {
  try {
    if (!ensureContract(predictionMarket, "PredictionMarket", res)) return;
    await syncLiveState();

    const marketId = req.params.marketId;
    if (!state.markets.has(marketId)) {
      return res.status(404).json({ error: "Market not found" });
    }

    res.json({ marketId, timeline: buildRiskTimeline(marketId) });
  } catch (error) {
    res.status(503).json({ error: error.message || "Failed to fetch risk timeline." });
  }
});

app.get("/api/analytics", async (_req, res) => {
  try {
    if (!ensureContract(predictionMarket, "PredictionMarket", res)) return;
    await syncLiveState();
    res.json(buildGlobalAnalytics());
  } catch (error) {
    res.status(503).json({ error: error.message || "Failed to fetch analytics." });
  }
});

app.get("/api/analytics/:marketId", async (req, res) => {
  try {
    if (!ensureContract(predictionMarket, "PredictionMarket", res)) return;
    await syncLiveState();

    const marketId = req.params.marketId;
    const analytics = buildMarketAnalytics(marketId);
    if (!analytics) {
      return res.status(404).json({ error: "Market not found" });
    }
    res.json(analytics);
  } catch (error) {
    res.status(503).json({ error: error.message || "Failed to fetch market analytics." });
  }
});

app.get("/api/analytics/:marketId/price-history", async (req, res) => {
  try {
    if (!ensureContract(predictionMarket, "PredictionMarket", res)) return;
    await syncLiveState();

    const marketId = req.params.marketId;
    if (!state.markets.has(marketId)) {
      return res.status(404).json({ error: "Market not found" });
    }

    const intervalSec = Math.max(60, Number(req.query.intervalSec || 300));
    const candles = buildPriceCandles(marketId, intervalSec);
    res.json({ marketId, intervalSec, candles });
  } catch (error) {
    res.status(503).json({ error: error.message || "Failed to fetch price history." });
  }
});

app.get("/api/analytics/:marketId/depth", async (req, res) => {
  try {
    if (!ensureContract(predictionMarket, "PredictionMarket", res)) return;
    if (!ensureContract(amm, "AMM", res)) return;
    await syncLiveState();

    const marketId = req.params.marketId;
    if (!state.markets.has(marketId)) {
      return res.status(404).json({ error: "Market not found" });
    }

    const rawDepth = await amm.getLiquidityDepth(marketId);
    const depth = rawDepth.map((entry) => ({
      price: toNumber(entry.price, 0) / 10000,
      buyDepth: Number(ethers.formatUnits(toBigInt(entry.buyDepth), 18)),
      sellDepth: Number(ethers.formatUnits(toBigInt(entry.sellDepth), 18)),
    }));

    res.json({ marketId, depth });
  } catch (error) {
    res.status(503).json({ error: error.message || "Failed to fetch liquidity depth." });
  }
});

app.get("/api/analytics/:marketId/oracle-performance", async (req, res) => {
  try {
    if (!ensureContract(predictionMarket, "PredictionMarket", res)) return;
    await syncLiveState();

    const marketId = req.params.marketId;
    if (!state.markets.has(marketId)) {
      return res.status(404).json({ error: "Market not found" });
    }

    res.json({ marketId, ...buildOraclePerformance(marketId) });
  } catch (error) {
    res.status(503).json({ error: error.message || "Failed to fetch oracle performance." });
  }
});

wss.on("connection", (socket) => {
  clients.add(socket);
  socket.send(
    JSON.stringify({
      type: "connected",
      payload: { timestamp: nowSec().toString() },
    })
  );
  socket.on("close", () => {
    clients.delete(socket);
  });
});

wss.on("error", (error) => {
  console.error("WebSocket server error:", error);
});

startOnchainListenersIfReady();
const listenerBootstrapTimer = setInterval(startOnchainListenersIfReady, 5000);
const stateSyncTimer = setInterval(() => {
  syncLiveState().catch(() => {});
}, SYNC_INTERVAL_MS);

function shutdown() {
  clearInterval(listenerBootstrapTimer);
  clearInterval(stateSyncTimer);

  for (const timer of marketRiskTimers.values()) {
    clearTimeout(timer);
  }
  marketRiskTimers.clear();

  if (ammListener) ammListener.removeAllListeners();
  if (predictionMarketListener) predictionMarketListener.removeAllListeners();
  if (settlementEngineListener) settlementEngineListener.removeAllListeners();
  if (governanceListener) governanceListener.removeAllListeners();

  if (
    listenerProviderErrorBinding &&
    typeof listenerProviderErrorBinding.off === "function"
  ) {
    listenerProviderErrorBinding.off("error", onListenerProviderError);
    listenerProviderErrorBinding = null;
  }

  if (wsListenerProvider && typeof wsListenerProvider.destroy === "function") {
    try {
      wsListenerProvider.destroy();
    } catch {
      // Ignore WebSocket teardown failures.
    }
  }

  for (const client of clients) {
    client.close();
  }

  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

server.listen(PORT, () => {
  if (!RPC_URL) {
    console.warn("NEXT_PUBLIC_RPC_URL is missing. Backend requires a live RPC endpoint.");
  }

  const missing = [];
  if (!addresses.predictionMarket) missing.push("NEXT_PUBLIC_PREDICTION_MARKET_ADDRESS");
  if (!addresses.amm) missing.push("NEXT_PUBLIC_AMM_ADDRESS");
  if (!addresses.settlementEngine) missing.push("NEXT_PUBLIC_SETTLEMENT_ENGINE_ADDRESS");
  if (!addresses.governance) missing.push("NEXT_PUBLIC_GOVERNANCE_ADDRESS");
  if (missing.length > 0) {
    console.warn(`Missing contract addresses: ${missing.join(", ")}`);
  }

  console.log(`DeepSeer backend listening on http://127.0.0.1:${PORT}`);
  if (wsListenerProvider) {
    console.log("Listener transport preference: websocket (NEXT_PUBLIC_WS_RPC_URL).");
  } else if (provider) {
    console.log(`Listener transport preference: http-polling (${LISTENER_POLL_INTERVAL_MS}ms).`);
  }
});

server.on("error", (error) => {
  if (error && error.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Stop the existing backend process or change PORT.`);
    process.exit(1);
  }

  console.error("Backend server failed to start:", error);
  process.exit(1);
});
