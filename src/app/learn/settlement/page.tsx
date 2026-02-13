export default function LearnSettlementPage() {
  return (
    <div className="space-y-4 p-4">
      <section className="rounded border p-4">
        <h2 className="text-lg font-semibold">How settlement works</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          At resolution time, the settlement engine receives oracle data and finalizes the winning
          outcome on-chain. Resolved markets can then distribute payouts to winning positions.
        </p>
      </section>
      <section className="rounded border p-4">
        <h2 className="text-lg font-semibold">Oracle role</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Oracles bridge real-world facts into smart contracts. If oracle updates are delayed, market
          status remains pending until a valid update arrives.
        </p>
      </section>
      <section className="rounded border p-4">
        <h2 className="text-lg font-semibold">Why verification matters</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Settlement events are publicly verifiable on-chain, so every participant can independently
          check resolution logic and timestamps.
        </p>
      </section>
    </div>
  );
}
