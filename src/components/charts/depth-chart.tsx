'use client';

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { LiquidityDepth } from '@/types';

interface DepthChartProps {
  data: LiquidityDepth[];
}

export function DepthChart({ data }: DepthChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = '';

    if (data.length === 0) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    const margin = { top: 12, right: 18, bottom: 24, left: 36 };

    const svg = d3
      .select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`);

    const x = d3
      .scaleLinear()
      .domain(d3.extent(data, (d) => d.price) as [number, number])
      .range([margin.left, width - margin.right]);

    const maxDepth = d3.max(data, (d) => Math.max(d.buyDepth, d.sellDepth)) ?? 0;
    const y = d3
      .scaleLinear()
      .domain([0, maxDepth])
      .nice()
      .range([height - margin.bottom, margin.top]);

    const buyLine = d3
      .line<LiquidityDepth>()
      .x((d) => x(d.price))
      .y((d) => y(d.buyDepth))
      .curve(d3.curveMonotoneX);

    const sellLine = d3
      .line<LiquidityDepth>()
      .x((d) => x(d.price))
      .y((d) => y(d.sellDepth))
      .curve(d3.curveMonotoneX);

    svg
      .append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#22c55e')
      .attr('stroke-width', 2)
      .attr('d', buyLine);

    svg
      .append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#ef4444')
      .attr('stroke-width', 2)
      .attr('d', sellLine);

    svg
      .append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat((v) => `${(Number(v) * 100).toFixed(0)}%`))
      .call((g) => g.select('.domain').attr('stroke', '#334155'))
      .call((g) => g.selectAll('line').attr('stroke', '#334155'))
      .call((g) => g.selectAll('text').attr('fill', '#94a3b8').attr('font-size', 11));

    svg
      .append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(4))
      .call((g) => g.select('.domain').attr('stroke', '#334155'))
      .call((g) => g.selectAll('line').attr('stroke', '#334155'))
      .call((g) => g.selectAll('text').attr('fill', '#94a3b8').attr('font-size', 11));
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Awaiting live liquidity depth from AMM...
      </div>
    );
  }

  return <div ref={containerRef} className="h-full w-full" />;
}
