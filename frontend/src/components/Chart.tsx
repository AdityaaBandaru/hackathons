"use client";

import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";

export function Chart({
  option,
  height = 320,
  ariaLabel,
}: {
  option: EChartsOption;
  height?: number;
  ariaLabel: string;
}) {
  return (
    <div role="img" aria-label={ariaLabel}>
      <ReactECharts
        option={option}
        style={{ height }}
        notMerge
        lazyUpdate
        opts={{ renderer: "svg" }}
      />
    </div>
  );
}
