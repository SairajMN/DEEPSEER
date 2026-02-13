'use client';

import { isConfigured } from '@/lib/config';
import { EmptyState } from '@/components/shared/empty-state';
import { CreateMarketForm } from '@/components/markets/create-market-form';

export default function CreateCategoricalMarketPage() {
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
        kind="categorical"
        title="Create Categorical Market"
        description="Categorical markets resolve to one option among multiple discrete outcomes."
      />
    </div>
  );
}
