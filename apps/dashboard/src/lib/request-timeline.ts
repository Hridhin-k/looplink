/**
 * Chrome DevTools–style timing model for a recorded Badger exchange.
 *
 * Today the inspector only exposes total {@link latencyMs}. Phase durations are
 * therefore derived with a stable proportional model and marked `estimated`.
 * When the API later ships absolute phase timestamps, pass them via
 * {@link RequestTimelineInput.phases}.
 */

export type RequestTimelinePhaseId = "received" | "tunnel" | "forward" | "application" | "response";

export interface RequestTimelinePhaseTiming {
  readonly id: RequestTimelinePhaseId;
  /** Offset from request start, in ms. */
  readonly startMs: number;
  /** Phase duration, in ms. */
  readonly durationMs: number;
}

export interface RequestTimelineInput {
  /** Epoch ms when the public request was received. */
  readonly timestamp: number;
  /** Total round-trip latency when the response completed. */
  readonly latencyMs?: number;
  /** Optional measured phase timings (absolute offsets from request start). */
  readonly phases?: readonly RequestTimelinePhaseTiming[];
}

export interface RequestTimelineSpan {
  readonly id: RequestTimelinePhaseId;
  readonly label: string;
  readonly description: string;
  /** Offset from request start, in ms. */
  readonly startMs: number;
  /** Phase duration, in ms. */
  readonly durationMs: number;
  /** True when duration was inferred from total latency. */
  readonly estimated: boolean;
  /** True when the phase has not completed yet. */
  readonly pending: boolean;
}

export interface RequestTimelineModel {
  readonly startedAt: number;
  readonly totalMs: number;
  readonly completed: boolean;
  readonly estimated: boolean;
  readonly spans: readonly RequestTimelineSpan[];
  /** Tick marks for the waterfall scale (ms from start). */
  readonly ticks: readonly number[];
}

const PHASE_META: Record<
  RequestTimelinePhaseId,
  { readonly label: string; readonly description: string }
> = {
  received: {
    label: "Received",
    description: "Public request accepted by the Badger server",
  },
  tunnel: {
    label: "Tunnel",
    description: "Queued and delivered to the CLI over the tunnel WebSocket",
  },
  forward: {
    label: "Forward",
    description: "CLI forwarded the request to the local application",
  },
  application: {
    label: "Application",
    description: "Waiting on the local application (TTFB)",
  },
  response: {
    label: "Response",
    description: "Response streamed back through the tunnel to the client",
  },
};

/**
 * Stable share of total latency used when measured phase timings are absent.
 * Application waiting dominates, matching typical DevTools “Waiting (TTFB)”.
 */
const ESTIMATED_WEIGHTS: Record<RequestTimelinePhaseId, number> = {
  received: 0.02,
  tunnel: 0.08,
  forward: 0.1,
  application: 0.65,
  response: 0.15,
};

const PHASE_ORDER: readonly RequestTimelinePhaseId[] = [
  "received",
  "tunnel",
  "forward",
  "application",
  "response",
];

/**
 * Builds a waterfall timeline model for the request details Timing panel.
 */
export function buildRequestTimeline(input: RequestTimelineInput): RequestTimelineModel {
  const startedAt = input.timestamp;

  if (input.phases !== undefined && input.phases.length > 0) {
    return fromMeasuredPhases(startedAt, input.phases, input.latencyMs);
  }

  if (input.latencyMs === undefined) {
    return pendingTimeline(startedAt);
  }

  return fromEstimatedLatency(startedAt, Math.max(0, input.latencyMs));
}

/**
 * Formats a duration the way DevTools does for short network timings.
 */
export function formatTimelineDuration(ms: number): string {
  if (!Number.isFinite(ms)) {
    return "—";
  }
  if (ms < 1) {
    return `${(ms * 1_000).toFixed(0)} µs`;
  }
  if (ms < 1_000) {
    return `${ms < 10 ? ms.toFixed(2) : ms.toFixed(1)} ms`;
  }
  return `${(ms / 1_000).toFixed(2)} s`;
}

/**
 * Evenly spaced scale ticks for a waterfall axis.
 */
export function buildTimelineTicks(totalMs: number, count = 5): number[] {
  if (totalMs <= 0) {
    return [0];
  }
  const steps = Math.max(2, count);
  const ticks: number[] = [];
  for (let i = 0; i < steps; i += 1) {
    ticks.push((totalMs * i) / (steps - 1));
  }
  return ticks;
}

function pendingTimeline(startedAt: number): RequestTimelineModel {
  const spans: RequestTimelineSpan[] = PHASE_ORDER.map((id, index) => ({
    id,
    label: PHASE_META[id].label,
    description: PHASE_META[id].description,
    startMs: 0,
    durationMs: id === "received" ? 0 : 0,
    estimated: true,
    pending: index > 0,
  }));

  return {
    startedAt,
    totalMs: 0,
    completed: false,
    estimated: true,
    spans,
    ticks: [0],
  };
}

function fromEstimatedLatency(startedAt: number, totalMs: number): RequestTimelineModel {
  const safeTotal = totalMs <= 0 ? 1 : totalMs;
  let cursor = 0;
  const spans: RequestTimelineSpan[] = [];

  for (const id of PHASE_ORDER) {
    const weight = ESTIMATED_WEIGHTS[id];
    const isLast = id === PHASE_ORDER[PHASE_ORDER.length - 1];
    const durationMs = isLast
      ? Math.max(0, safeTotal - cursor)
      : Math.max(0, Math.round(safeTotal * weight * 100) / 100);
    spans.push({
      id,
      label: PHASE_META[id].label,
      description: PHASE_META[id].description,
      startMs: cursor,
      durationMs,
      estimated: true,
      pending: false,
    });
    cursor += durationMs;
  }

  return {
    startedAt,
    totalMs: safeTotal,
    completed: true,
    estimated: true,
    spans,
    ticks: buildTimelineTicks(safeTotal),
  };
}

function fromMeasuredPhases(
  startedAt: number,
  phases: readonly RequestTimelinePhaseTiming[],
  latencyMs: number | undefined,
): RequestTimelineModel {
  const byId = new Map(phases.map((phase) => [phase.id, phase]));
  let endMs = 0;

  const spans: RequestTimelineSpan[] = PHASE_ORDER.map((id) => {
    const measured = byId.get(id);
    if (measured === undefined) {
      return {
        id,
        label: PHASE_META[id].label,
        description: PHASE_META[id].description,
        startMs: 0,
        durationMs: 0,
        estimated: true,
        pending: latencyMs === undefined,
      };
    }

    endMs = Math.max(endMs, measured.startMs + measured.durationMs);
    return {
      id,
      label: PHASE_META[id].label,
      description: PHASE_META[id].description,
      startMs: measured.startMs,
      durationMs: measured.durationMs,
      estimated: false,
      pending: false,
    };
  });

  const totalMs = latencyMs ?? endMs;

  return {
    startedAt,
    totalMs,
    completed: latencyMs !== undefined || endMs > 0,
    estimated: spans.some((span) => span.estimated && !span.pending),
    spans,
    ticks: buildTimelineTicks(Math.max(totalMs, 1)),
  };
}
