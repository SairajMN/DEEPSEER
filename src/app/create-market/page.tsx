'use client';

import { isConfigured } from '@/lib/config';
import { EmptyState } from '@/components/shared/empty-state';
import { CreateMarketForm } from '@/components/markets/create-market-form';

export default function CreateBinaryMarketPage() {
  if (!isConfigured()) {
    return (
      <EmptyState
        type="not-configured"
        title="Blockchain Not Configured"
        description="Set contract addresses in environment variables to create new markets."
      />
    );
  }

  return (
    <div className="p-4">
      <CreateMarketForm
        kind="binary"
        title="Create Binary Market"
        description="Binary markets resolve to one of two outcomes."
      />
    </div>
  );
}
