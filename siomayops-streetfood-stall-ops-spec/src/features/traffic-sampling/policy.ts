/** PHASE 0 — this pilot is hard-disabled in production; dev/test require explicit opt-in. */
export const isTrafficSamplingEnabled = (): boolean =>
  process.env.NODE_ENV !== "production" && process.env.TRAFFIC_SAMPLING_ENABLED === "true";
