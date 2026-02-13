'use client';

import { useRef, useEffect } from 'react';
import type { PricePoint } from '@/types';

export function PriceChart({ data }: { data: PricePoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<{
    chart: {
      remove: () => void;
      applyOptions: (opts: { width: number; height: number }) => void;
      addCandlestickSeries: (opts: Record<string, unknown>) => { setData: (d: unknown[]) => void };
      addHistogramSeries: (opts: Record<string, unknown>) => { setData: (d: unknown[]) => void };
    };
    candleSeries: { setData: (d: unknown[]) => void };
    volumeSeries: { setData: (d: unknown[]) => void };
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let cleanup: (() => void) | undefined;

    (async () => {
      try {
        const { createChart, ColorType, CrosshairMode } = await import('lightweight-charts');

        if (!containerRef.current) return;

        const chart = createChart(containerRef.current, {
          layout: {
            background: { type: ColorType.Solid, color: 'transparent' },
            textColor: '#9ca3af',
          },
          grid: {
            vertLines: { color: 'rgba(255,255,255,0.05)' },
            horzLines: { color: 'rgba(255,255,255,0.05)' },
          },
          crosshair: { mode: CrosshairMode.Normal },
          rightPriceScale: {
            borderColor: 'rgba(255,255,255,0.1)',
          },
          timeScale: {
            borderColor: 'rgba(255,255,255,0.1)',
            timeVisible: true,
          },
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });

        const typedChart = chart as unknown as {
          addCandlestickSeries: (opts: Record<string, unknown>) => { setData: (d: unknown[]) => void };
          addHistogramSeries: (opts: Record<string, unknown>) => { setData: (d: unknown[]) => void };
          applyOptions: (opts: { width: number; height: number }) => void;
          remove: () => void;
        };

        const candleSeries = typedChart.addCandlestickSeries({
          upColor: '#22c55e',
          downColor: '#ef4444',
          borderDownColor: '#ef4444',
          borderUpColor: '#22c55e',
          wickDownColor: '#ef4444',
          wickUpColor: '#22c55e',
        });

        const volumeSeries = typedChart.addHistogramSeries({
          color: 'rgba(99, 102, 241, 0.3)',
          priceFormat: { type: 'volume' },
          priceScaleId: '',
        });

        chartRef.current = { chart: typedChart, candleSeries, volumeSeries };

        // Handle resize
        const resizeObserver = new ResizeObserver((entries) => {
          for (const entry of entries) {
            typedChart.applyOptions({
              width: entry.contentRect.width,
              height: entry.contentRect.height,
            });
          }
        });
        resizeObserver.observe(containerRef.current);

        cleanup = () => {
          resizeObserver.disconnect();
          typedChart.remove();
        };
      } catch {
        // Chart library failed to load
      }
    })();

    return () => cleanup?.();
  }, []);

  // Update data
  useEffect(() => {
    if (!chartRef.current || data.length === 0) return;
    const { candleSeries, volumeSeries } = chartRef.current;

    candleSeries.setData(
      data.map((d) => ({
        time: d.time,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }))
    );

    volumeSeries.setData(
      data.map((d) => ({
        time: d.time,
        value: d.volume,
        color: d.close >= d.open ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)',
      }))
    );
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Awaiting price data from AMM contract...
      </div>
    );
  }

  return <div ref={containerRef} className="w-full h-full" />;
}
