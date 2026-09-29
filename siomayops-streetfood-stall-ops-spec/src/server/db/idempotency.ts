import { memoryStore, idempotencyMapKey, generateId, type StoredIdempotency } from "./memory-store";

export interface IdempotencyRecord {
  readonly key: string;
  readonly organizationId: string;
  readonly actorId: string;
  readonly requestHash: string;
  readonly responseBody: unknown;
  readonly statusCode: number;
  readonly createdAt: Date;
  readonly expiresAt: Date;
}

function hashRequest(payload: unknown): string {
  return JSON.stringify(payload);
}

export async function beginIdempotentRequest(input: {
  key: string;
  organizationId: string;
  actorId: string;
  requestHash: string;
  route: string;
}): Promise<{ kind: "NEW" } | { kind: "REPLAY"; record: IdempotencyRecord }> {
  const mapKey = idempotencyMapKey(input.organizationId, input.route, input.key);
  const existing = memoryStore.idempotency.get(mapKey);
  if (existing) {
    if (existing.requestHash !== input.requestHash) {
      const err = new Error("Idempotency key mismatch: same key with different payload");
      (err as any).code = "IDEMPOTENCY_MISMATCH";
      throw err;
    }
    // Check expiry
    if (existing.expiresAt < new Date()) {
      // Expired, treat as new but remove old
      memoryStore.idempotency.delete(mapKey);
      return { kind: "NEW" };
    }
    return {
      kind: "REPLAY",
      record: {
        key: existing.idempotencyKey,
        organizationId: existing.organizationId,
        actorId: input.actorId,
        requestHash: existing.requestHash,
        responseBody: JSON.parse(existing.responseJson),
        statusCode: existing.statusCode,
        createdAt: existing.createdAt,
        expiresAt: existing.expiresAt,
      }
    };
  }
  return { kind: "NEW" };
}

export async function storeIdempotentResponse(input: {
  key: string;
  organizationId: string;
  route: string;
  requestHash: string;
  responseBody: unknown;
  statusCode: number;
  ttlSeconds?: number;
}): Promise<void> {
  const mapKey = idempotencyMapKey(input.organizationId, input.route, input.key);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + (input.ttlSeconds ?? 24 * 3600) * 1000);
  const record: StoredIdempotency = {
    id: generateId(),
    organizationId: input.organizationId,
    route: input.route,
    idempotencyKey: input.key,
    requestHash: input.requestHash,
    responseJson: JSON.stringify(input.responseBody),
    statusCode: input.statusCode,
    createdAt: now,
    expiresAt,
  };
  memoryStore.idempotency.set(mapKey, record);
}

const inFlightRequests = new Map<
  string,
  { requestHash: string; promise: Promise<{ body: unknown; status: number }> }
>();

// Convenience wrapper used by API routes
export async function withIdempotency<T>(
  opts: {
    organizationId: string;
    route: string;
    idempotencyKey: string;
    requestHash: string;
    actorId: string;
  },
  fn: () => Promise<{ body: T; status: number }>
): Promise<{ body: T; status: number; replayed: boolean }> {
  const mapKey = idempotencyMapKey(opts.organizationId, opts.route, opts.idempotencyKey);
  const begin = await beginIdempotentRequest({
    key: opts.idempotencyKey,
    organizationId: opts.organizationId,
    actorId: opts.actorId,
    requestHash: opts.requestHash,
    route: opts.route,
  });
  if (begin.kind === "REPLAY") {
    return { body: begin.record.responseBody as T, status: begin.record.statusCode, replayed: true };
  }

  const existingInFlight = inFlightRequests.get(mapKey);
  if (existingInFlight) {
    if (existingInFlight.requestHash !== opts.requestHash) {
      const err = new Error("Idempotency key mismatch: same key with different payload");
      (err as any).code = "IDEMPOTENCY_MISMATCH";
      throw err;
    }
    const settled = await existingInFlight.promise;
    return { body: settled.body as T, status: settled.status, replayed: true };
  }

  const execPromise = (async () => {
    const result = await fn();
    await storeIdempotentResponse({
      key: opts.idempotencyKey,
      organizationId: opts.organizationId,
      route: opts.route,
      requestHash: opts.requestHash,
      responseBody: result.body,
      statusCode: result.status,
    });
    return result;
  })();

  inFlightRequests.set(mapKey, { requestHash: opts.requestHash, promise: execPromise });
  try {
    const result = await execPromise;
    return { ...result, replayed: false };
  } finally {
    inFlightRequests.delete(mapKey);
  }
}
