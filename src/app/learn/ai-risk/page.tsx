export default function LearnAIRiskPage() {
  return (
    <div className="space-y-4 p-4">
      <section className="rounded border p-4">
        <h2 className="text-lg font-semibold">What is AI risk scoring?</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          DeepSeer’s risk engine computes confidence from live market entropy, liquidity, trade
          stability, and oracle freshness. It does not inject synthetic market values.
        </p>
      </section>
      <section className="rounded border p-4">
        <h2 className="text-lg font-semibold">Source Agreement</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Source agreement measures how consistent independent inputs are with current market state.
          Lower agreement typically implies higher uncertainty.
        </p>
      </section>
      <section className="rounded border p-4">
        <h2 className="text-lg font-semibold">Anomaly Flags</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Anomaly flags highlight conditions like stale oracle updates, rapid volatility spikes, or low
          liquidity. Flags are deterministic outputs from observed data.
        </p>
      </section>
    </div>
  );
}
