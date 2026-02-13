'use client';

import { useEffect } from 'react';
import { useWalletStore } from '@/store';

export function WalletListener() {
  const { setAddress, setChainId, disconnect } = useWalletStore();

  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) return;

    const handleAccountsChanged = (accounts: unknown) => {
      const accs = accounts as string[];
      if (accs.length === 0) {
        disconnect();
      } else {
        setAddress(accs[0]);
      }
    };

    const handleChainChanged = (chainId: unknown) => {
      setChainId(parseInt(chainId as string, 16));
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    // Check if already connected
    window.ethereum
      .request({ method: 'eth_accounts' })
      .then((accounts: unknown) => {
        const accs = accounts as string[];
        if (accs.length > 0) {
          setAddress(accs[0]);
          window.ethereum!.request({ method: 'eth_chainId' }).then((chainId: unknown) => {
            setChainId(parseInt(chainId as string, 16));
          });
        }
      })
      .catch(() => {});

    return () => {
      window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum?.removeListener('chainChanged', handleChainChanged);
    };
  }, [setAddress, setChainId, disconnect]);

  return null;
}
