'use client';

import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AnalyticsFeesPage() {
  return (
    <div className="p-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fee Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            type="no-data"
            title="Fee Data Unavailable On-Chain"
            description="Current DeepSeer contracts do not expose fee accounting events. Fee distribution will appear when fee telemetry is added to deployed contracts."
          />
        </CardContent>
      </Card>
    </div>
  );
}
