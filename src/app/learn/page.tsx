export default function LearnPredictionMarketsPage() {
  return (
    <div className="space-y-4 p-4">
      <section className="rounded border p-4">
        <h2 className="text-lg font-semibold">What is a prediction market?</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A prediction market lets participants buy and sell outcome shares for future events. Prices
          represent collective probability estimates and update continuously as traders express views.
        </p>
      </section>
      <section className="rounded border p-4">
        <h2 className="text-lg font-semibold">How probabilities emerge</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          In binary markets, if YES trades near 0.72 then the market implies roughly 72% probability
          of YES. In categorical markets, probabilities are split across more than two outcomes.
        </p>
      </section>
      <section className="rounded border p-4">
        <h2 className="text-lg font-semibold">Why this matters</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Market-based probabilities often react faster than surveys because capital is at risk and
          prices aggregate many independent judgments.
        </p>
      </section>
    </div>
  );
}
