import { ethers } from 'ethers';
import { config } from '@/lib/config';
import {
  PREDICTION_MARKET_ABI,
  AMM_ABI,
  SETTLEMENT_ENGINE_ABI,
  GOVERNANCE_ABI,
  ERC20_ABI,
} from './abis';

// Singleton provider — only created if config is present
let _provider: ethers.JsonRpcProvider | null = null;
let _wsProvider: ethers.WebSocketProvider | null = null;
let _walletProvider: ethers.Eip1193Provider | null = null;

function resolveWalletProvider(): ethers.Eip1193Provider | null {
  if (_walletProvider) return _walletProvider;
  if (typeof window !== 'undefined' && window.ethereum) {
    return window.ethereum as unknown as ethers.Eip1193Provider;
  }
  return null;
}

export function setWalletProvider(provider: ethers.Eip1193Provider | null) {
  _walletProvider = provider;
}

export function getProvider(): ethers.JsonRpcProvider {
  if (!config.rpcUrl) {
    throw new Error('RPC URL not configured. Set NEXT_PUBLIC_RPC_URL.');
  }
  if (!_provider) {
    _provider = new ethers.JsonRpcProvider(config.rpcUrl, config.chainId);
  }
  return _provider;
}

export function getWsProvider(): ethers.WebSocketProvider {
  if (!config.wsRpcUrl) {
    throw new Error('WebSocket RPC URL not configured. Set NEXT_PUBLIC_WS_RPC_URL.');
  }
  if (!_wsProvider) {
    _wsProvider = new ethers.WebSocketProvider(config.wsRpcUrl, config.chainId);
  }
  return _wsProvider;
}

export async function getSigner(): Promise<ethers.JsonRpcSigner | null> {
  const browserProvider = await getBrowserProvider();
  if (!browserProvider) return null;
  return browserProvider.getSigner();
}

export async function getBrowserProvider(): Promise<ethers.BrowserProvider | null> {
  const provider = resolveWalletProvider();
  if (!provider) return null;
  return new ethers.BrowserProvider(provider);
}

// Read-only contracts (use JSON-RPC provider)
export function getPredictionMarketContract(): ethers.Contract {
  return new ethers.Contract(config.contracts.predictionMarket, PREDICTION_MARKET_ABI, getProvider());
}

export function getAMMContract(): ethers.Contract {
  return new ethers.Contract(config.contracts.amm, AMM_ABI, getProvider());
}

export function getSettlementContract(): ethers.Contract {
  return new ethers.Contract(config.contracts.settlementEngine, SETTLEMENT_ENGINE_ABI, getProvider());
}

export function getGovernanceContract(): ethers.Contract {
  return new ethers.Contract(config.contracts.governance, GOVERNANCE_ABI, getProvider());
}

export function getTokenContract(): ethers.Contract {
  return new ethers.Contract(config.contracts.token, ERC20_ABI, getProvider());
}

// Write contracts (use signer from wallet)
export async function getSignedAMMContract(): Promise<ethers.Contract> {
  const provider = await getBrowserProvider();
  if (!provider) throw new Error('No wallet connected');
  const signer = await provider.getSigner();
  return new ethers.Contract(config.contracts.amm, AMM_ABI, signer);
}

export async function getSignedPredictionMarketContract(): Promise<ethers.Contract> {
  const provider = await getBrowserProvider();
  if (!provider) throw new Error('No wallet connected');
  const signer = await provider.getSigner();
  return new ethers.Contract(config.contracts.predictionMarket, PREDICTION_MARKET_ABI, signer);
}

export async function getSignedSettlementContract(): Promise<ethers.Contract> {
  const provider = await getBrowserProvider();
  if (!provider) throw new Error('No wallet connected');
  const signer = await provider.getSigner();
  return new ethers.Contract(config.contracts.settlementEngine, SETTLEMENT_ENGINE_ABI, signer);
}

export async function getSignedGovernanceContract(): Promise<ethers.Contract> {
  const provider = await getBrowserProvider();
  if (!provider) throw new Error('No wallet connected');
  const signer = await provider.getSigner();
  return new ethers.Contract(config.contracts.governance, GOVERNANCE_ABI, signer);
}

export async function getSignedTokenContract(): Promise<ethers.Contract> {
  const provider = await getBrowserProvider();
  if (!provider) throw new Error('No wallet connected');
  const signer = await provider.getSigner();
  return new ethers.Contract(config.contracts.token, ERC20_ABI, signer);
}

// Parse revert reasons for user-friendly errors
export function parseContractError(error: unknown): string {
  if (error instanceof Error) {
    const msg = error.message;
    // ethers v6 error parsing
    if (msg.includes('user rejected')) return 'Transaction rejected by user.';
    if (msg.includes('insufficient funds')) return 'Insufficient funds for transaction.';
    if (msg.includes('execution reverted')) {
      const match = msg.match(/reason="([^"]+)"/);
      if (match) return `Contract error: ${match[1]}`;
      return 'Transaction reverted by contract.';
    }
    if (msg.includes('nonce')) return 'Nonce error — please reset your wallet.';
    return msg;
  }
  return 'Unknown contract error.';
}

// Format bigint values to human-readable
export function formatTokenAmount(amount: bigint, decimals: number = 18): string {
  return ethers.formatUnits(amount, decimals);
}

export function parseTokenAmount(amount: string, decimals: number = 18): bigint {
  return ethers.parseUnits(amount, decimals);
}

export function formatPrice(priceBps: bigint): string {
  return (Number(priceBps) / 10000).toFixed(4);
}

export function formatPercentage(bps: bigint): string {
  return (Number(bps) / 100).toFixed(2) + '%';
}

export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
