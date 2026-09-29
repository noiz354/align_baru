import { memoryStore, generateId } from "../../server/db/memory-store";
import { writeAuditEvent } from "../audit";

// MOCK ONLY — TEMPORARY SERVER ADAPTER — REPLACE WITH REAL DOMAIN/PERSISTENCE
const DEFAULT_ORG = process.env.FAKE_ORG_ID || "00000000-0000-7000-0000-000000000001";

export interface MessageThread {
  id: string;
  organizationId: string;
  topicType: string;
  topicId: string;
  createdAt: Date;
}

export interface Message {
  id: string;
  threadId: string;
  organizationId: string;
  authorId: string;
  body: string;
  createdAt: Date;
}

const threads = new Map<string, MessageThread>();
const messages = new Map<string, Message[]>();

export async function createThread(input: {
  topicType: string; topicId: string; organizationId?: string; createdBy: string;
}): Promise<MessageThread> {
  const orgId = input.organizationId || DEFAULT_ORG;
  const id = generateId();
  const thread: MessageThread = {
    id,
    organizationId: orgId,
    topicType: input.topicType,
    topicId: input.topicId,
    createdAt: new Date(),
  };
  threads.set(id, thread);
  messages.set(id, []);
  await writeAuditEvent({
    organizationId: orgId,
    actorKind: "HQ_USER",
    actorId: input.createdBy,
    action: "config.changed",
    subjectKind: "message_thread",
    subjectId: id,
    correlationId: generateId(),
    occurredAt: new Date(),
    afterSummary: { topicType: input.topicType, topicId: input.topicId },
  });
  return thread;
}

export async function postMessage(input: {
  threadId: string; body: string; authorId: string; organizationId?: string;
}): Promise<Message> {
  const thread = threads.get(input.threadId);
  if (!thread) throw Object.assign(new Error("Thread not found"), { code: "NOT_FOUND" });
  const id = generateId();
  const msg: Message = {
    id,
    threadId: input.threadId,
    organizationId: thread.organizationId,
    authorId: input.authorId,
    body: input.body,
    createdAt: new Date(),
  };
  const list = messages.get(input.threadId) || [];
  list.push(msg);
  messages.set(input.threadId, list);
  return msg;
}

export async function listMessages(threadId: string): Promise<Message[]> {
  return messages.get(threadId) || [];
}
