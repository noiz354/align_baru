export type ChannelKind = "IN_APP" | "WEB_PUSH" | "EMAIL" | "WHATSAPP" | "SMS";

export interface NotificationPayload {
  readonly organizationId: string;
  readonly recipientUserIds: readonly string[];
  readonly templateId: string;
  readonly variables: Readonly<Record<string, string>>;
  readonly severity: "INFO" | "ATTENTION" | "URGENT";
  readonly subjectRef: { readonly kind: string; readonly id: string };
}

export interface NotificationChannel {
  readonly kind: ChannelKind;
  send(payload: NotificationPayload): Promise<{ readonly attemptId: string }>;
}

import { memoryStore, generateId } from "../db/memory-store";

class InAppChannel implements NotificationChannel {
  readonly kind: ChannelKind = "IN_APP";

  async send(payload: NotificationPayload): Promise<{ readonly attemptId: string }> {
    const attemptId = generateId();
    // Store as alert for now
    for (const recipient of payload.recipientUserIds) {
      const alertId = generateId();
      memoryStore.alerts.set(alertId, {
        id: alertId,
        organizationId: payload.organizationId,
        type: payload.templateId,
        severity: payload.severity === "URGENT" ? "CRITICAL" : payload.severity === "ATTENTION" ? "WARNING" : "INFO",
        message: `Notification for ${recipient}: ${payload.templateId} - ${JSON.stringify(payload.variables)}`,
        relatedEntityType: payload.subjectRef.kind,
        relatedEntityId: payload.subjectRef.id,
        acknowledged: false,
        createdAt: new Date(),
      });
    }
    return { attemptId };
  }
}

class NoOpChannel implements NotificationChannel {
  constructor(readonly kind: ChannelKind) {}
  async send(_payload: NotificationPayload): Promise<{ readonly attemptId: string }> {
    return { attemptId: generateId() };
  }
}

export function createChannel(kind: ChannelKind): NotificationChannel {
  switch (kind) {
    case "IN_APP":
      return new InAppChannel();
    case "WEB_PUSH":
    case "EMAIL":
    case "WHATSAPP":
    case "SMS":
      return new NoOpChannel(kind);
    default:
      return new NoOpChannel(kind);
  }
}
