import { trace, context, type Span } from "@opentelemetry/api";

export function withSpan<T>(name: string, fn: (span: Span) => Promise<T>): Promise<T> {
  const tracer = trace.getTracer("siomayops");
  return tracer.startActiveSpan(name, async (span) => {
    try {
      const result = await fn(span);
      span.setStatus({ code: 1 });
      return result;
    } catch (e) {
      span.setStatus({ code: 2, message: (e as Error).message });
      span.recordException(e as Error);
      throw e;
    } finally {
      span.end();
    }
  });
}

export function getCurrentTraceId(): string | undefined {
  const span = trace.getSpan(context.active());
  return span?.spanContext().traceId;
}
