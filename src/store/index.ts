import { create } from 'zustand';
import type {
  Market,
  Position,
  Order,
  TradeEvent,
  AIRiskScore,
  OracleUpdate,
  Proposal,
  WalletState,
  WebSocketStatus,
  PricePoint,
  LiquidityDepth,
  PortfolioMetrics,
  SimpleMode,
} from '@/types';
import { config } from '@/lib/config';
import { setWalletProvider } from '@/lib/contracts';

// ============================================================
// Market Store
// ============================================================
interface MarketStore {
  markets: Map<string, Market>;
  loading: boolean;
  error: string | null;
  setMarkets: (markets: Market[]) => void;
  updateMarket: (id: string, updates: Partial<Market>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  getActiveMarkets: () => Market[];
  getResolvingMarkets: () => Market[];
  getResolvedMarkets: () => Market[];
}

export const useMarketStore = create<MarketStore>((set, get) => ({
  markets: new Map(),
  loading: false,
  error: null,
  setMarkets: (markets) =>
    set({ markets: new Map(markets.map((m) => [m.id, m])), loading: false }),
  updateMarket: (id, updates) =>
    set((state) => {
      const newMap = new Map(state.markets);
      const existing = newMap.get(id);
      if (existing) newMap.set(id, { ...existing, ...updates });
      return { markets: newMap };
    }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error, loading: false }),
  getActiveMarkets: () =>
    Array.from(get().markets.values()).filter((m) => m.status === 'active'),
  getResolvingMarkets: () =>
    Array.from(get().markets.values()).filter((m) => m.status === 'resolving'),
  getResolvedMarkets: () =>
    Array.from(get().markets.values()).filter((m) => m.status === 'resolved'),
}));

// ============================================================
// Selected Market Store
// ============================================================
interface SelectedMarketStore {
  selectedMarketId: string | null;
  priceHistory: PricePoint[];
  liquidityDepth: LiquidityDepth[];
  recentTrades: TradeEvent[];
  setSelectedMarket: (id: string | null) => void;
  addPricePoint: (point: PricePoint) => void;
  setPriceHistory: (history: PricePoint[]) => void;
  setLiquidityDepth: (depth: LiquidityDepth[]) => void;
  addTrade: (trade: TradeEvent) => void;
  setRecentTrades: (trades: TradeEvent[]) => void;
}

export const useSelectedMarketStore = create<SelectedMarketStore>((set) => ({
  selectedMarketId: null,
  priceHistory: [],
  liquidityDepth: [],
  recentTrades: [],
  setSelectedMarket: (id) =>
    set({ selectedMarketId: id, priceHistory: [], liquidityDepth: [], recentTrades: [] }),
  addPricePoint: (point) =>
    set((state) => ({ priceHistory: [...state.priceHistory, point] })),
  setPriceHistory: (history) => set({ priceHistory: history }),
  setLiquidityDepth: (depth) => set({ liquidityDepth: depth }),
  addTrade: (trade) =>
    set((state) => ({ recentTrades: [trade, ...state.recentTrades].slice(0, 100) })),
  setRecentTrades: (trades) => set({ recentTrades: trades }),
}));

// ============================================================
// Portfolio Store
// ============================================================
interface PortfolioStore {
  positions: Position[];
  orders: Order[];
  metrics: PortfolioMetrics | null;
  loading: boolean;
  error: string | null;
  setPositions: (positions: Position[]) => void;
  setOrders: (orders: Order[]) => void;
  setMetrics: (metrics: PortfolioMetrics) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const usePortfolioStore = create<PortfolioStore>((set) => ({
  positions: [],
  orders: [],
  metrics: null,
  loading: false,
  error: null,
  setPositions: (positions) => set({ positions }),
  setOrders: (orders) => set({ orders }),
  setMetrics: (metrics) => set({ metrics }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error, loading: false }),
}));

// ============================================================
// Wallet Store
// ============================================================
interface WalletConnectProviderLike {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  accounts?: string[];
  chainId?: number | string;
  on: (event: string, listener: (...args: unknown[]) => void) => unknown;
}

let walletConnectProvider: WalletConnectProviderLike | null = null;

interface WalletStore extends WalletState {
  walletType: 'injected' | 'walletconnect' | null;
  connect: () => Promise<void>;
  connectInjected: () => Promise<void>;
  connectWalletConnect: () => Promise<void>;
  disconnect: () => void;
  setAddress: (address: string | null) => void;
  setChainId: (chainId: number | null) => void;
  setBalance: (balance: bigint | null) => void;
  setTokenBalance: (balance: bigint | null) => void;
  setError: (error: string | null) => void;
}

export const useWalletStore = create<WalletStore>((set) => ({
  address: null,
  chainId: null,
  isConnected: false,
  isConnecting: false,
  balance: null,
  tokenBalance: null,
  error: null,
  walletType: null,
  connect: async () => {
    await useWalletStore.getState().connectInjected();
  },
  connectInjected: async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      set({ error: 'No wallet detected. Install MetaMask or another Web3 wallet.' });
      return;
    }
    set({ isConnecting: true, error: null });
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' }) as string[];
      const chainId = await window.ethereum.request({ method: 'eth_chainId' }) as string;
      setWalletProvider(window.ethereum as unknown as import('ethers').Eip1193Provider);
      set({
        address: accounts[0],
        chainId: parseInt(chainId, 16),
        isConnected: true,
        isConnecting: false,
        walletType: 'injected',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to connect wallet';
      set({ error: message, isConnecting: false });
    }
  },
  connectWalletConnect: async () => {
    set({ isConnecting: true, error: null });

    try {
      if (!config.walletConnectProjectId) {
        throw new Error('WalletConnect project ID missing (NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID).');
      }
      if (!config.rpcUrl) {
        throw new Error('RPC URL missing (NEXT_PUBLIC_RPC_URL).');
      }

      const { EthereumProvider } = await import('@walletconnect/ethereum-provider');

      if (walletConnectProvider) {
        try {
          await walletConnectProvider.disconnect();
        } catch {
          // Ignore disconnect errors from previous stale sessions.
        }
      }

      walletConnectProvider = (await EthereumProvider.init({
        projectId: config.walletConnectProjectId,
        chains: [config.chainId],
        optionalChains: [config.chainId],
        rpcMap: { [config.chainId]: config.rpcUrl },
        showQrModal: true,
      })) as unknown as WalletConnectProviderLike;

      await walletConnectProvider.connect();

      const accounts = (walletConnectProvider.accounts ?? []) as string[];
      const chainId = Number(walletConnectProvider.chainId ?? config.chainId);

      setWalletProvider(walletConnectProvider as unknown as import('ethers').Eip1193Provider);

      set({
        address: accounts[0] ?? null,
        chainId,
        isConnected: accounts.length > 0,
        isConnecting: false,
        walletType: 'walletconnect',
      });

      walletConnectProvider.on('accountsChanged', (payload: unknown) => {
        const accountList = payload as string[];
        useWalletStore.getState().setAddress(accountList.length > 0 ? accountList[0] : null);
      });

      walletConnectProvider.on('chainChanged', (payload: unknown) => {
        const nextChain = typeof payload === 'string' ? Number(payload) : Number(payload);
        useWalletStore.getState().setChainId(Number.isFinite(nextChain) ? nextChain : null);
      });

      walletConnectProvider.on('disconnect', () => {
        useWalletStore.getState().disconnect();
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to connect WalletConnect';
      set({ error: message, isConnecting: false });
    }
  },
  disconnect: () => {
    const { walletType } = useWalletStore.getState();
    if (walletType === 'walletconnect' && walletConnectProvider) {
      walletConnectProvider.disconnect().catch(() => {});
      walletConnectProvider = null;
    }

    setWalletProvider(null);
    set({
      address: null,
      chainId: null,
      isConnected: false,
      balance: null,
      tokenBalance: null,
      error: null,
      walletType: null,
    });
  },
  setAddress: (address) => set({ address, isConnected: !!address }),
  setChainId: (chainId) => set({ chainId }),
  setBalance: (balance) => set({ balance }),
  setTokenBalance: (balance) => set({ tokenBalance: balance }),
  setError: (error) => set({ error }),
}));

// ============================================================
// AI Risk Store
// ============================================================
interface AIRiskStore {
  scores: Map<string, AIRiskScore>;
  loading: boolean;
  error: string | null;
  setScore: (marketId: string, score: AIRiskScore) => void;
  setScores: (scores: AIRiskScore[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useAIRiskStore = create<AIRiskStore>((set) => ({
  scores: new Map(),
  loading: false,
  error: null,
  setScore: (marketId, score) =>
    set((state) => {
      const newMap = new Map(state.scores);
      newMap.set(marketId, score);
      return { scores: newMap };
    }),
  setScores: (scores) =>
    set({ scores: new Map(scores.map((s) => [s.marketId, s])), loading: false }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error, loading: false }),
}));

// ============================================================
// Oracle Store
// ============================================================
interface OracleStore {
  updates: Map<string, OracleUpdate[]>;
  addUpdate: (update: OracleUpdate) => void;
  setUpdates: (marketId: string, updates: OracleUpdate[]) => void;
}

export const useOracleStore = create<OracleStore>((set) => ({
  updates: new Map(),
  addUpdate: (update) =>
    set((state) => {
      const newMap = new Map(state.updates);
      const existing = newMap.get(update.marketId) ?? [];
      newMap.set(update.marketId, [...existing, update]);
      return { updates: newMap };
    }),
  setUpdates: (marketId, updates) =>
    set((state) => {
      const newMap = new Map(state.updates);
      newMap.set(marketId, updates);
      return { updates: newMap };
    }),
}));

// ============================================================
// Governance Store
// ============================================================
interface GovernanceStore {
  proposals: Proposal[];
  votingPower: bigint | null;
  lockedTokens: bigint | null;
  loading: boolean;
  error: string | null;
  setProposals: (proposals: Proposal[]) => void;
  setVotingPower: (power: bigint) => void;
  setLockedTokens: (amount: bigint) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useGovernanceStore = create<GovernanceStore>((set) => ({
  proposals: [],
  votingPower: null,
  lockedTokens: null,
  loading: false,
  error: null,
  setProposals: (proposals) => set({ proposals, loading: false }),
  setVotingPower: (power) => set({ votingPower: power }),
  setLockedTokens: (amount) => set({ lockedTokens: amount }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error, loading: false }),
}));

// ============================================================
// WebSocket Store
// ============================================================
interface WSStore extends WebSocketStatus {
  setConnected: (connected: boolean) => void;
  setReconnecting: (reconnecting: boolean) => void;
  setLastMessage: (timestamp: number) => void;
  setError: (error: string | null) => void;
}

export const useWSStore = create<WSStore>((set) => ({
  connected: false,
  reconnecting: false,
  lastMessage: null,
  error: null,
  setConnected: (connected) => set({ connected, reconnecting: false }),
  setReconnecting: (reconnecting) => set({ reconnecting }),
  setLastMessage: (timestamp) => set({ lastMessage: timestamp }),
  setError: (error) => set({ error }),
}));

// ============================================================
// UI Store (simple mode, theme)
// ============================================================
interface UIStore {
  simpleMode: SimpleMode;
  toggleSimpleMode: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeSubTab: string;
  setActiveSubTab: (tab: string) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  simpleMode: true,
  toggleSimpleMode: () => set((state) => ({ simpleMode: !state.simpleMode })),
  activeTab: 'markets',
  setActiveTab: (tab) => set({ activeTab: tab, activeSubTab: '' }),
  activeSubTab: '',
  setActiveSubTab: (tab) => set({ activeSubTab: tab }),
}));
