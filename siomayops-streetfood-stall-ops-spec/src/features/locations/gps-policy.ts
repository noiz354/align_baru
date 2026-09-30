/** Production opt-in stays closed until privacy/DPO, durable retention, and backup gates are signed off. */
export const isGpsSampleCaptureEnabled = (): boolean =>
  process.env.NODE_ENV !== "production" || process.env.GPS_LOCATION_SAMPLES_ENABLED === "true";
