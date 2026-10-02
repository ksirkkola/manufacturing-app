import type { HailerApi, InsightData } from '@hailer/app-sdk';

const GAP_MS = 200;

// Module-level chain shared by every component in the app (not per-tab) — tabs
// are independent React components with their own effects, so without this a
// shared refresh tick (see use-refresh.ts) fires every mounted tab's forced
// insight recompute in the same instant, bursting the API and tripping its
// rate limiter ("Error: $: Rate limit exceeded. Field: undefined, undefined").
// Routing every hailer.insight.data({update:true}) call through here serializes
// them app-wide with a small gap between each, regardless of which tab or how
// many tabs fire at once.
let chain: Promise<unknown> = Promise.resolve();

/**
 * Forced-recompute insight read ({ update: true }), queued behind every other
 * pending call made through this module. Use this instead of calling
 * hailer.insight.data directly so concurrent reads from different tabs don't
 * land as a simultaneous burst.
 */
export function fetchInsight(hailer: HailerApi, insightId: string): Promise<InsightData> {
  const run = chain.then(() => hailer.insight.data(insightId, { update: true }));
  // Queue the gap-delay regardless of success/failure so one bad insight doesn't wedge the queue.
  chain = run.then(() => undefined, () => undefined).then(() => new Promise(resolve => setTimeout(resolve, GAP_MS)));
  return run;
}

/** Convenience wrapper: queues several insight reads and resolves once all have completed, in request order. */
export function fetchInsights(hailer: HailerApi, insightIds: string[]): Promise<InsightData[]> {
  return Promise.all(insightIds.map(id => fetchInsight(hailer, id)));
}
