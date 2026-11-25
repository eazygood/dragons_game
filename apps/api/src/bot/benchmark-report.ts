import type { StrategyName } from '@bigbank-dragon/contracts';

import type { BotRunResult } from './types.ts';

const PERCENT = 100;

export type BenchmarkStats = {
  runs: number;
  passRate: number;
  min: number;
  median: number;
  max: number;
  meanTurns: number;
  target: number;
};

export type BenchmarkSummary = BenchmarkStats & { benchmarkId: string; strategy: StrategyName };

const medianOf = ({ sorted }: { sorted: number[] }) => {
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[middle] ?? 0;
  }

  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
};

export const summarise = ({
  results,
  target,
}: {
  results: BotRunResult[];
  target: number;
}): BenchmarkStats => {
  if (results.length === 0) {
    return { runs: 0, passRate: 0, min: 0, median: 0, max: 0, meanTurns: 0, target };
  }

  const sorted = results.map(({ score }) => score).sort((left, right) => left - right);
  const passes = sorted.filter((score) => score >= target).length;
  const totalTurns = results.reduce((sum, { turns }) => sum + turns, 0);

  return {
    runs: results.length,
    passRate: passes / results.length,
    min: sorted[0] ?? 0,
    median: medianOf({ sorted }),
    max: sorted.at(-1) ?? 0,
    meanTurns: totalTurns / results.length,
    target,
  };
};

export const formatSummary = ({ summary }: { summary: BenchmarkSummary }): string =>
  [
    `Benchmark ${summary.benchmarkId} (${summary.strategy}, ${summary.runs} runs)`,
    `  pass rate ${Math.round(summary.passRate * PERCENT)}% at >= ${summary.target}`,
    `  score min ${summary.min} · median ${summary.median} · max ${summary.max}`,
    `  mean turns ${summary.meanTurns.toFixed(1)}`,
  ].join('\n');
