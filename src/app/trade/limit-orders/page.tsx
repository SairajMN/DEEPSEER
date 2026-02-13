'use client';

import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function LimitOrdersPage() {
  return (
    <div className="p-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Limit Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            type="no-data"
            title="Limit order book unavailable on-chain"
            description="The deployed AMM contract exposes market buy/sell methods only and does not include native limit-order storage. To enable this tab, deploy a limit-order contract or backend matcher and connect it here."
          />
        </CardContent>
      </Card>
    </div>
  );
}
