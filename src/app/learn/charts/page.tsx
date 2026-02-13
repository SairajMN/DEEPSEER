export default function LearnChartsPage() {
  return (
    <div className="space-y-4 p-4">
      <section className="rounded border p-4">
        <h2 className="text-lg font-semibold">How to read candlesticks</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Each candle shows open, high, low, and close price for a time bucket. Green candles close
          above open; red candles close below open.
        </p>
      </section>
      <section className="rounded border p-4">
        <h2 className="text-lg font-semibold">Depth chart basics</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Depth curves show available buy and sell liquidity across price levels. Steeper curves usually
          indicate concentrated liquidity and larger slippage risk for big trades.
        </p>
      </section>
      <section className="rounded border p-4">
        <h2 className="text-lg font-semibold">Confidence and risk timelines</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Confidence meters summarize current risk state, while timelines show trade/oracle/anomaly
          events that explain how risk changed over time.
        </p>
      </section>
    </div>
  );
}
