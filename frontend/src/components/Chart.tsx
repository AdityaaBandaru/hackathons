"use client";

import ReactECharts from "echarts-for-react";
import { registerTheme, type EChartsOption } from "echarts";

/**
 * One ECharts theme for the whole app, matching the page tokens: muted axis
 * text, hairline grid, dark tooltip. Series colours come from each option so
 * the semantic mapping (temporary = amber, permanent = green, ...) stays
 * with the data, not the theme.
 */
const THEME = "wc26";
const FG_MUTED = "#8a8f98";
const FG_SUBTLE = "#62666d";
const HAIRLINE = "rgba(255,255,255,0.07)";

let registered = false;
function ensureTheme() {
  if (registered) return;
  registered = true;
  registerTheme(THEME, {
    backgroundColor: "transparent",
    textStyle: { color: FG_MUTED, fontFamily: "inherit" },
    title: { textStyle: { color: "#f7f8f8" } },
    legend: { textStyle: { color: FG_MUTED }, itemGap: 14 },
    tooltip: {
      backgroundColor: "#16171b",
      borderColor: "rgba(255,255,255,0.1)",
      borderWidth: 1,
      textStyle: { color: "#f7f8f8", fontSize: 12 },
      extraCssText:
        "border-radius:10px;box-shadow:0 12px 32px -8px rgba(0,0,0,.8);padding:8px 12px;",
    },
    categoryAxis: {
      axisLine: { lineStyle: { color: HAIRLINE } },
      axisTick: { show: false },
      axisLabel: { color: FG_MUTED, fontSize: 11 },
      splitLine: { show: false },
    },
    valueAxis: {
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: FG_SUBTLE, fontSize: 11 },
      splitLine: { lineStyle: { color: HAIRLINE } },
      nameTextStyle: { color: FG_SUBTLE, fontSize: 11 },
    },
    bar: { itemStyle: { borderRadius: [0, 3, 3, 0] } },
    line: { smooth: true, symbolSize: 6, lineStyle: { width: 2 } },
  });
}

export function Chart({
  option,
  height = 320,
  ariaLabel,
}: {
  option: EChartsOption;
  height?: number;
  ariaLabel: string;
}) {
  ensureTheme();
  return (
    <div role="img" aria-label={ariaLabel} className="animate-fade-in">
      <ReactECharts
        option={option}
        theme={THEME}
        style={{ height }}
        notMerge
        lazyUpdate
        opts={{ renderer: "svg" }}
      />
    </div>
  );
}
