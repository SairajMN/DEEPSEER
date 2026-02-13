export default function LearnAMMPage() {
  return (
    <div className="space-y-4 p-4">
      <section className="rounded border p-4">
        <h2 className="text-lg font-semibold">How AMMs work</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          AMMs quote prices algorithmically from pool state. You can always trade against liquidity in
          the contract without waiting for a counterparty order.
        </p>
      </section>
      <section className="rounded border p-4">
        <h2 className="text-lg font-semibold">Slippage</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Large orders move AMM prices. The difference between expected and executed price is slippage.
          Higher liquidity usually reduces slippage.
        </p>
      </section>
      <section className="rounded border p-4">
        <h2 className="text-lg font-semibold">Liquidity providers</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Liquidity providers deposit capital into pools, helping traders execute efficiently. Provider
          risk depends on market volatility and directional flow.
        </p>
      </section>
    </div>
  );
}
