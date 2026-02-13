'use client';

import { useEffect, useState } from 'react';
import { isConfigured } from '@/lib/config';
import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ProposalRow {
  id: string;
  proposer: string;
  description: string;
  status: number;
  forVotes: bigint;
  againstVotes: bigint;
  startBlock: bigint;
  endBlock: bigint;
  executed: boolean;
}

export default function GovernanceHistoryPage() {
  const [rows, setRows] = useState<ProposalRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isConfigured()) return;
    let cancelled = false;

    const load = async () => {
      try {
        const { getGovernanceContract } = await import('@/lib/contracts');
        const governance = getGovernanceContract();
        const count = Number(await governance.getProposalCount());
        const result: ProposalRow[] = [];
        for (let i = 0; i < count; i++) {
          const proposal = await governance.getProposal(i);
          result.push({
            id: i.toString(),
            proposer: proposal.proposer,
            description: proposal.description,
            status: Number(proposal.status),
            forVotes: proposal.forVotes as bigint,
            againstVotes: proposal.againstVotes as bigint,
            startBlock: proposal.startBlock as bigint,
            endBlock: proposal.endBlock as bigint,
            executed: Boolean(proposal.executed),
          });
        }
        if (!cancelled) {
          setRows(result.reverse());
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to fetch governance history');
        }
      }
    };

    load();
    const interval = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (!isConfigured()) {
    return (
      <EmptyState
        type="not-configured"
        title="Blockchain Not Configured"
        description="Set contract addresses in environment variables to load governance."
      />
    );
  }

  if (error) {
    return <EmptyState type="error" title="Governance History Unavailable" description={error} />;
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        type="no-data"
        title="No historical votes"
        description="Governance history will appear after proposals are created on-chain."
      />
    );
  }

  return (
    <div className="p-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historical Votes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4">ID</th>
                  <th className="pb-2 pr-4">Description</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">For</th>
                  <th className="pb-2 pr-4">Against</th>
                  <th className="pb-2 pr-4">Blocks</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-border/40">
                    <td className="py-2 pr-4">{row.id}</td>
                    <td className="py-2 pr-4">{row.description}</td>
                    <td className="py-2 pr-4">{row.executed ? 'executed' : row.status}</td>
                    <td className="py-2 pr-4">{row.forVotes.toString()}</td>
                    <td className="py-2 pr-4">{row.againstVotes.toString()}</td>
                    <td className="py-2 pr-4">
                      {row.startBlock.toString()} - {row.endBlock.toString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
