'use client';

import { isConfigured } from '@/lib/config';
import { EmptyState } from '@/components/shared/empty-state';
import { CreateMarketForm } from '@/components/markets/create-market-form';

export default function CreateScalarMarketPage() {
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
        kind="scalar"
        title="Create Scalar Market"
        description="Scalar markets resolve along a numeric range represented by outcomes."
      />
    </div>
  );
}
