/**
 * server/telemetry — public surface. Used by: composition only.
 * The logger FACADE (redaction-applied) is exported from here so features
 * can log without importing OTel/pino directly (rule D4).
 */
export * from './otel';
