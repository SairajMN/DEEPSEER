'use client';

import { useWalletStore } from '@/store';
import { Button } from '@/components/ui/button';
import { Wallet, LogOut, Loader2, Smartphone } from 'lucide-react';
import { shortenAddress } from '@/lib/contracts';

export function WalletButton() {
  const {
    address,
    isConnected,
    isConnecting,
    error,
    walletType,
    connectInjected,
    connectWalletConnect,
    disconnect,
  } = useWalletStore();

  if (isConnecting) {
    return (
      <Button variant="outline" disabled className="gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Connecting...
      </Button>
    );
  }

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <div className="px-3 py-1.5 text-sm rounded-md bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20">
          {shortenAddress(address)} {walletType === 'walletconnect' ? '(WC)' : '(MM)'}
        </div>
        <Button variant="ghost" size="icon" onClick={disconnect} title="Disconnect wallet">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end">
      <div className="flex gap-2">
        <Button onClick={connectInjected} className="gap-2" variant="outline">
          <Wallet className="h-4 w-4" />
          MetaMask
        </Button>
        <Button onClick={connectWalletConnect} className="gap-2">
          <Smartphone className="h-4 w-4" />
          WalletConnect
        </Button>
      </div>
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}
