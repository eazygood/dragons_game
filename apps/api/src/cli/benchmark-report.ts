import type { BotRunResult, BotStrategy } from '../managers/bot-manager.ts';

const PERCENT = 100;
const percentOf = ({ rate }: { rate: number }) => `${Math.round(rate * PERCENT)}%`;
const MILLISECONDS_PER_SECOND = 1000;

type BenchmarkStats = {
  runs: number;
  /** Runs that threw before finishing; they count as misses in the pass rate. */
  failedRuns: number;
  passRate: number;
  /** The strategy on its own: an upstream outage cannot push it down. */
  passRateOfFinishedRuns: number;
  min: number;
  median: number;
  max: number;
  meanTurns: number;
  /** Wall time from the game's `started_at` to `ended_at`; unfinished rows have no end. */
  meanDurationInSeconds: number;
  target: number;
};

export type BenchmarkSummary = BenchmarkStats & { benchmarkId: string; strategy: BotStrategy };

const meanOf = ({ values }: { values: number[] }) =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

const medianOf = ({ sorted }: { sorted: number[] }) => {
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[middle] ?? 0;
  }

  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
};

// Score and turn figures describe the finished runs only; a failed run has no score.
export const summarise = ({
  results,
  failedRuns = 0,
  runDurationsInMs,
  target,
}: {
  results: BotRunResult[];
  failedRuns?: number;
  runDurationsInMs: number[];
  target: number;
}): BenchmarkStats => {
  const runs = results.length + failedRuns;
  const meanDurationInSeconds = meanOf({ values: runDurationsInMs }) / MILLISECONDS_PER_SECOND;

  if (results.length === 0) {
    return {
      runs,
      failedRuns,
      passRate: 0,
      passRateOfFinishedRuns: 0,
      min: 0,
      median: 0,
      max: 0,
      meanTurns: 0,
      meanDurationInSeconds,
      target,
    };
  }

  const sorted = results.map(({ score }) => score).sort((left, right) => left - right);
  const passes = sorted.filter((score) => score >= target).length;

  return {
    runs,
    failedRuns,
    passRate: passes / runs,
    passRateOfFinishedRuns: passes / results.length,
    min: sorted[0] ?? 0,
    median: medianOf({ sorted }),
    max: sorted.at(-1) ?? 0,
    meanTurns: meanOf({ values: results.map(({ turns }) => turns) }),
    meanDurationInSeconds,
    target,
  };
};

// With failures, both rates print: a failed run is a miss, but it says nothing about the strategy.
const formatPassRate = ({ summary }: { summary: BenchmarkSummary }) => {
  const passRate = `  pass rate ${percentOf({ rate: summary.passRate })} at >= ${summary.target}`;

  if (summary.failedRuns === 0) {
    return passRate;
  }

  const finishedRuns = summary.runs - summary.failedRuns;

  return `${passRate} · ${percentOf({ rate: summary.passRateOfFinishedRuns })} of the ${finishedRuns} finished runs`;
};

export const formatSummary = ({ summary }: { summary: BenchmarkSummary }): string =>
  [
    `Benchmark ${summary.benchmarkId} (${summary.strategy}, ${summary.runs} runs, ${summary.failedRuns} failed)`,
    formatPassRate({ summary }),
    `  score min ${summary.min} · median ${summary.median} · max ${summary.max}`,
    `  mean turns ${summary.meanTurns.toFixed(1)} · mean duration ${summary.meanDurationInSeconds.toFixed(1)}s`,
  ].join('\n');
