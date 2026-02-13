// ============================================================
// DeepSeer Global Types — All data originates from chain/backend
// ============================================================

export type MarketStatus = 'active' | 'resolving' | 'resolved';
export type MarketType = 'binary' | 'scalar' | 'categorical' | 'conditional';
export type OrderSide = 'buy' | 'sell';
export type OrderType = 'market' | 'limit';
export type ProposalStatus = 'active' | 'passed' | 'rejected' | 'executed';

export interface Market {
  id: string; // on-chain market ID
  question: string;
  marketType: MarketType;
  status: MarketStatus;
  creator: string;
  createdAt: bigint;
  resolutionTime: bigint;
  totalLiquidity: bigint;
  volume: bigint;
  outcomes: string[];
  outcomePrices: bigint[]; // AMM prices per outcome (basis points)
  oracleSource: string;
  resolved: boolean;
  winningOutcome: number | null;
}

export interface Position {
  marketId: string;
  outcome: number;
  shares: bigint;
  avgPrice: bigint;
  currentPrice: bigint;
  pnl: bigint;
}

export interface Order {
  id: string;
  marketId: string;
  trader: string;
  side: OrderSide;
  orderType: OrderType;
  outcome: number;
  amount: bigint;
  price: bigint;
  filled: bigint;
  timestamp: bigint;
  status: 'open' | 'filled' | 'cancelled';
}

export interface TradeEvent {
  marketId: string;
  trader: string;
  outcome: number;
  side: OrderSide;
  amount: bigint;
  price: bigint;
  timestamp: bigint;
  txHash: string;
}

export interface LiquidityEvent {
  marketId: string;
  provider: string;
  amount: bigint;
  timestamp: bigint;
  txHash: string;
}

export interface AIRiskScore {
  marketId: string;
  confidenceScore: number; // 0-100
  sourceAgreement: number; // 0-100
  temporalConsistency: number; // 0-100
  anomalyFlags: AnomalyFlag[];
  dataSources: DataSource[];
  lastUpdated: bigint;
}

export interface AnomalyFlag {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  timestamp: bigint;
}

export interface DataSource {
  name: string;
  reliability: number;
  lastFetch: bigint;
  status: 'active' | 'stale' | 'offline';
}

export interface OracleUpdate {
  marketId: string;
  value: bigint;
  timestamp: bigint;
  roundId: bigint;
}

export interface Proposal {
  id: string;
  proposer: string;
  description: string;
  status: ProposalStatus;
  forVotes: bigint;
  againstVotes: bigint;
  startBlock: bigint;
  endBlock: bigint;
  executed: boolean;
}

export interface WalletState {
  address: string | null;
  chainId: number | null;
  isConnected: boolean;
  isConnecting: boolean;
  balance: bigint | null;
  tokenBalance: bigint | null;
  error: string | null;
}

export interface WebSocketStatus {
  connected: boolean;
  reconnecting: boolean;
  lastMessage: number | null;
  error: string | null;
}

export interface PricePoint {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface LiquidityDepth {
  price: number;
  buyDepth: number;
  sellDepth: number;
}

export interface PortfolioMetrics {
  totalValue: bigint;
  totalPnl: bigint;
  winRate: number;
  sharpeRatio: number;
  maxDrawdown: number;
  positionCount: number;
}

// Contract config loaded from env
export interface ContractConfig {
  predictionMarket: string;
  amm: string;
  settlementEngine: string;
  governance: string;
  token: string;
}

export type SimpleMode = boolean;
