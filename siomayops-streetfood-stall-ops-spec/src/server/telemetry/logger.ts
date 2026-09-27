import pino from "pino";

export interface LogContext {
  readonly organizationId?: string;
  readonly actorId?: string;
  readonly correlationId?: string;
  readonly route?: string;
  readonly jobName?: string;
}

export interface Logger {
  info(message: string, context?: LogContext & Record<string, unknown>): void;
  warn(message: string, context?: LogContext & Record<string, unknown>): void;
  error(message: string, error: unknown, context?: LogContext & Record<string, unknown>): void;
}

const baseLogger = pino({
  level: process.env.LOG_LEVEL || "info",
  formatters: {
    level(label) {
      return { level: label };
    },
  },
});

export function createLogger(): Logger {
  return {
    info(message: string, context?: LogContext & Record<string, unknown>) {
      baseLogger.info({ ...context }, message);
    },
    warn(message: string, context?: LogContext & Record<string, unknown>) {
      baseLogger.warn({ ...context }, message);
    },
    error(message: string, error: unknown, context?: LogContext & Record<string, unknown>) {
      baseLogger.error({ ...context, err: error }, message);
    },
  };
}

export const logger = createLogger();
