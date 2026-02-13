'use client';

import { useCallback, useEffect, useState } from 'react';
import { useGovernanceStore, useWalletStore } from '@/store';
import { isConfigured } from '@/lib/config';
import { parseContractError, shortenAddress } from '@/lib/contracts';
import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const statusLabel: Record<number, 'active' | 'passed' | 'rejected' | 'executed'> = {
  0: 'active',
  1: 'passed',
  2: 'rejected',
  3: 'executed',
};

export default function GovernanceActiveProposalsPage() {
  const { proposals, loading, error, setProposals, setLoading, setError } = useGovernanceStore();
  const { isConnected } = useWalletStore();
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadProposals = useCallback(async () => {
    if (!isConfigured()) return;
    setLoading(true);
    try {
      const { getGovernanceContract } = await import('@/lib/contracts');
      const governance = getGovernanceContract();
      const count = Number(await governance.getProposalCount());
      const list = [];
      for (let i = 0; i < count; i++) {
        const proposal = await governance.getProposal(i);
        list.push({
          id: i.toString(),
          proposer: proposal.proposer,
          description: proposal.description,
          status: statusLabel[Number(proposal.status)] ?? 'active',
          forVotes: proposal.forVotes as bigint,
          againstVotes: proposal.againstVotes as bigint,
          startBlock: proposal.startBlock as bigint,
          endBlock: proposal.endBlock as bigint,
          executed: Boolean(proposal.executed),
        });
      }
      setProposals(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch proposals');
    }
  }, [setError, setLoading, setProposals]);

  useEffect(() => {
    loadProposals();
    const interval = setInterval(loadProposals, 20_000);
    return () => clearInterval(interval);
  }, [loadProposals]);

  const handleCreateProposal = useCallback(async () => {
    if (!description.trim()) return;
    setSubmitting(true);
    try {
      const { getSignedGovernanceContract } = await import('@/lib/contracts');
      const governance = await getSignedGovernanceContract();
      const tx = await governance.propose(description.trim(), '0x');
      toast.info('Proposal transaction submitted');
      await tx.wait();
      toast.success('Proposal created');
      setDescription('');
      await loadProposals();
    } catch (err) {
      toast.error(parseContractError(err));
    } finally {
      setSubmitting(false);
    }
  }, [description, loadProposals]);

  const handleVote = useCallback(
    async (proposalId: string, support: boolean) => {
      setSubmitting(true);
      try {
        const { getSignedGovernanceContract } = await import('@/lib/contracts');
        const governance = await getSignedGovernanceContract();
        const tx = await governance.vote(proposalId, support);
        toast.info('Vote transaction submitted');
        await tx.wait();
        toast.success('Vote recorded');
        await loadProposals();
      } catch (err) {
        toast.error(parseContractError(err));
      } finally {
        setSubmitting(false);
      }
    },
    [loadProposals]
  );

  const handleExecute = useCallback(
    async (proposalId: string) => {
      setSubmitting(true);
      try {
        const { getSignedGovernanceContract } = await import('@/lib/contracts');
        const governance = await getSignedGovernanceContract();
        const tx = await governance.execute(proposalId);
        toast.info('Execution transaction submitted');
        await tx.wait();
        toast.success('Proposal executed');
        await loadProposals();
      } catch (err) {
        toast.error(parseContractError(err));
      } finally {
        setSubmitting(false);
      }
    },
    [loadProposals]
  );

  if (!isConfigured()) {
    return (
      <EmptyState
        type="not-configured"
        title="Blockchain Not Configured"
        description="Set contract addresses in environment variables to load governance."
      />
    );
  }

  if (loading && proposals.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading proposals...
      </div>
    );
  }

  if (error) {
    return <EmptyState type="error" title="Governance Unavailable" description={error} />;
  }

  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create Proposal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label>Description</Label>
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Describe your governance proposal..."
          />
          <Button disabled={!isConnected || !description.trim() || submitting} onClick={handleCreateProposal}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {!isConnected ? 'Connect Wallet' : 'Submit Proposal'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Proposals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {proposals.length === 0 ? (
            <EmptyState
              type="no-data"
              title="No proposals on-chain"
              description="Create the first governance proposal to start protocol voting."
            />
          ) : (
            proposals.map((proposal) => (
              <div key={proposal.id} className="rounded border p-3">
                <div className="mb-1 flex items-center justify-between">
                  <div className="font-medium">Proposal #{proposal.id}</div>
                  <div className="text-xs uppercase text-muted-foreground">{proposal.status}</div>
                </div>
                <p className="text-sm">{proposal.description}</p>
                <div className="mt-2 text-xs text-muted-foreground">
                  Proposer: {shortenAddress(proposal.proposer)}
                </div>
                <div className="mt-2 grid gap-2 text-xs md:grid-cols-2">
                  <div>For: {proposal.forVotes.toString()}</div>
                  <div>Against: {proposal.againstVotes.toString()}</div>
                  <div>Start Block: {proposal.startBlock.toString()}</div>
                  <div>End Block: {proposal.endBlock.toString()}</div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!isConnected || submitting || proposal.status !== 'active'}
                    onClick={() => handleVote(proposal.id, true)}
                  >
                    Vote For
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!isConnected || submitting || proposal.status !== 'active'}
                    onClick={() => handleVote(proposal.id, false)}
                  >
                    Vote Against
                  </Button>
                  <Button
                    size="sm"
                    disabled={!isConnected || submitting || proposal.status !== 'passed'}
                    onClick={() => handleExecute(proposal.id)}
                  >
                    Execute
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
