/**
 * Realtime server — standalone ws server that handles queue, matchmaking, chat, signaling.
 *
 * This is the realtime service (ARCHITECTURE.md §3.2).
 * Runs separately from Next.js web service.
 */

import { createRealtimeTransport } from './transport';
import { createQueueService } from '../../features/queue/queue.service';
import { createMatchmakingService } from '../../features/matchmaking/matchmaking.service';
import { createChatService } from '../../features/chat/chat.service';
import { createReportsService } from '../../features/reports/reports.service';
import { createBlocksService } from '../../features/blocks/blocks.service';
import { sessionStore, queueStore, messageBuffer } from '../db/in-memory';
import { generateId } from '../../shared/utils/id';
import type { MatchRequest } from '../../domain/matchmaking/match-request';

const PORT = parseInt(process.env.REALTIME_PORT || '3001', 10);

const transport = createRealtimeTransport(PORT);
const queueService = createQueueService();
const matchmakingService = createMatchmakingService();
const chatService = createChatService();
const reportsService = createReportsService();
const blocksService = createBlocksService();

transport.onEvent(async (event) => {
  try {
    if (event.type === 'open') {
      console.log(`[realtime] open: ${event.participantId}`);
    } else if (event.type === 'close') {
      console.log(`[realtime] close: ${event.participantId} code=${event.code} reason=${event.reason}`);
      // On disconnect while waiting, hold queue entry for bounded reconnect window (STATE_MACHINE.md §7)
      // For simplicity, leave queue immediately if disconnect is normal
      if (event.code === 1000 || event.code === 1001) {
        const entry = queueStore.get(event.participantId);
        if (entry) {
          // Hold for 15s reconnect window, then expire
          setTimeout(() => {
            if (!queueStore.get(event.participantId)) return;
            // Check if still disconnected
            queueStore.leave(event.participantId);
          }, 15_000);
        }
      } else {
        // Policy violation or other — immediate leave
        queueStore.leave(event.participantId);
      }
      // If active session, notify peer
      const activeSession = sessionStore.getActiveForParticipant(event.participantId);
      if (activeSession) {
        const peerId = activeSession.participantAId === event.participantId ? activeSession.participantBId : activeSession.participantAId;
        try {
          await transport.send(peerId, {
            type: 'PEER_LEFT',
            messageId: generateId(),
            sessionId: activeSession.id,
            fromParticipantId: event.participantId,
            sequence: 0,
            sentAt: new Date().toISOString(),
            payload: { reasonClass: 'transport-lost' },
          } as any);
        } catch {}
      }
    } else if (event.type === 'message') {
      const msg = event.message;
      const participantId = event.participantId;

      switch (msg.type) {
        case 'JOIN_QUEUE': {
          const payload = msg.payload as any;
          try {
            const entry = await queueService.joinQueue({
              participantId,
              mode: payload.mode,
              interestIds: payload.interestIds || [],
              language: payload.language || null,
              regionConstraint: payload.regionConstraint || null,
            });

            // Try matchmaking immediately
            const request: MatchRequest = {
              participantId,
              mode: payload.mode,
              interestIds: payload.interestIds || [],
              language: payload.language || null,
              regionConstraint: payload.regionConstraint || null,
              joinedAt: entry.joinedAt,
            };

            const result = await matchmakingService.findMatch(request);
            if (result.matched && result.sessionId) {
              // Notify both participants MATCH_FOUND
              const session = sessionStore.get(result.sessionId);
              if (session) {
                const payloadA = {
                  sessionId: session.id,
                  peerRole: 'A' as const,
                  mode: session.mode,
                  matchedAt: new Date().toISOString(),
                  interestOverlap: result.interestOverlap,
                };
                const payloadB = {
                  sessionId: session.id,
                  peerRole: 'B' as const,
                  mode: session.mode,
                  matchedAt: new Date().toISOString(),
                  interestOverlap: result.interestOverlap,
                };

                await transport.send(session.participantAId, {
                  type: 'MATCH_FOUND',
                  messageId: generateId(),
                  sessionId: session.id,
                  fromParticipantId: 'server',
                  sequence: 1,
                  sentAt: new Date().toISOString(),
                  payload: payloadA,
                } as any);

                await transport.send(session.participantBId, {
                  type: 'MATCH_FOUND',
                  messageId: generateId(),
                  sessionId: session.id,
                  fromParticipantId: 'server',
                  sequence: 1,
                  sentAt: new Date().toISOString(),
                  payload: payloadB,
                } as any);
              }
            }
          } catch (e) {
            const err = e as Error;
            let code: any = 'INTERNAL';
            let retryable = false;
            let retryAfterMs: number | undefined;

            if (err.message.includes('RATE_LIMITED')) {
              code = 'RATE_LIMITED';
              retryable = true;
              const match = err.message.match(/retry after (\d+)ms/);
              if (match) retryAfterMs = parseInt(match[1], 10);
            } else if (err.message.includes('COOLDOWN')) {
              code = 'RATE_LIMITED';
              retryable = true;
            } else if (err.message.includes('RESTRICTED')) {
              code = 'RESTRICTED';
            }

            await transport.send(participantId, {
              type: 'ERROR',
              messageId: generateId(),
              sessionId: null,
              fromParticipantId: 'server',
              sequence: 0,
              sentAt: new Date().toISOString(),
              payload: {
                code,
                message: err.message,
                retryable,
                retryAfterMs,
              },
            } as any);
          }
          break;
        }

        case 'MESSAGE_SEND': {
          const payload = msg.payload as any;
          const result = await chatService.sendMessage({
            sessionId: msg.sessionId!,
            senderParticipantId: participantId,
            body: payload.body,
          });

          if (result.status === 'rejected') {
            await transport.send(participantId, {
              type: 'MESSAGE_REJECTED',
              messageId: generateId(),
              sessionId: msg.sessionId,
              fromParticipantId: 'server',
              sequence: 0,
              sentAt: new Date().toISOString(),
              payload: {
                clientMessageId: payload.clientMessageId,
                reasonClass: result.rejectionReason,
              },
            } as any);
          } else {
            // Relay to peer
            const session = sessionStore.get(msg.sessionId!);
            if (session) {
              const peerId = session.participantAId === participantId ? session.participantBId : session.participantAId;
              try {
                await transport.send(peerId, {
                  type: 'MESSAGE_DELIVERED',
                  messageId: generateId(),
                  sessionId: msg.sessionId,
                  fromParticipantId: participantId,
                  sequence: result.sequence,
                  sentAt: new Date().toISOString(),
                  payload: {
                    clientMessageId: payload.clientMessageId,
                    body: payload.body,
                    deliveredAt: new Date().toISOString(),
                  },
                } as any);
              } catch {}
            }
          }
          break;
        }

        case 'REPORT_SUBMITTED': {
          const payload = msg.payload as any;
          try {
            const ack = await reportsService.submitReport(participantId, {
              sessionId: msg.sessionId!,
              category: payload.category,
              note: payload.note || null,
            });

            await transport.send(participantId, {
              type: 'REPORT_SUBMITTED',
              messageId: generateId(),
              sessionId: msg.sessionId,
              fromParticipantId: 'server',
              sequence: 0,
              sentAt: new Date().toISOString(),
              payload: {
                category: payload.category,
                note: null,
              },
            } as any);

            // End session after report
            const session = sessionStore.get(msg.sessionId!);
            if (session) {
              sessionStore.updateStatus(session.id, 'REPORTED', 'report');
              const peerId = session.participantAId === participantId ? session.participantBId : session.participantAId;
              try {
                await transport.send(peerId, {
                  type: 'PEER_LEFT',
                  messageId: generateId(),
                  sessionId: session.id,
                  fromParticipantId: participantId,
                  sequence: 0,
                  sentAt: new Date().toISOString(),
                  payload: { reasonClass: 'reported' },
                } as any);
              } catch {}
              await transport.send(participantId, {
                type: 'SESSION_ENDED',
                messageId: generateId(),
                sessionId: session.id,
                fromParticipantId: 'server',
                sequence: 0,
                sentAt: new Date().toISOString(),
                payload: {
                  endReason: 'report',
                  durationMs: Date.now() - session.createdAt.getTime(),
                  requeueOffered: true,
                },
              } as any);
            }
          } catch (e) {
            const err = e as Error;
            await transport.send(participantId, {
              type: 'ERROR',
              messageId: generateId(),
              sessionId: msg.sessionId,
              fromParticipantId: 'server',
              sequence: 0,
              sentAt: new Date().toISOString(),
              payload: {
                code: 'INTERNAL',
                message: err.message,
                retryable: false,
              },
            } as any);
          }
          break;
        }

        case 'BLOCK_CREATED': {
          const payload = msg.payload as any;
          try {
            await blocksService.createBlock(participantId, {
              sessionId: msg.sessionId!,
              scope: payload.scope,
            });

            const session = sessionStore.get(msg.sessionId!);
            if (session) {
              sessionStore.updateStatus(session.id, 'BLOCKED', 'block');
              const peerId = session.participantAId === participantId ? session.participantBId : session.participantAId;
              try {
                await transport.send(peerId, {
                  type: 'PEER_LEFT',
                  messageId: generateId(),
                  sessionId: session.id,
                  fromParticipantId: participantId,
                  sequence: 0,
                  sentAt: new Date().toISOString(),
                  payload: { reasonClass: 'blocked' },
                } as any);
              } catch {}
              await transport.send(participantId, {
                type: 'SESSION_ENDED',
                messageId: generateId(),
                sessionId: session.id,
                fromParticipantId: 'server',
                sequence: 0,
                sentAt: new Date().toISOString(),
                payload: {
                  endReason: 'block',
                  durationMs: Date.now() - session.createdAt.getTime(),
                  requeueOffered: true,
                },
              } as any);
            }
          } catch (e) {
            const err = e as Error;
            await transport.send(participantId, {
              type: 'ERROR',
              messageId: generateId(),
              sessionId: msg.sessionId,
              fromParticipantId: 'server',
              sequence: 0,
              sentAt: new Date().toISOString(),
              payload: {
                code: 'INTERNAL',
                message: err.message,
                retryable: false,
              },
            } as any);
          }
          break;
        }

        case 'OFFER':
        case 'ANSWER':
        case 'ICE_CANDIDATE': {
          // Opaque relay — server never parses SDP (ADR-004 rule 6)
          const session = sessionStore.get(msg.sessionId!);
          if (!session) {
            await transport.send(participantId, {
              type: 'ERROR',
              messageId: generateId(),
              sessionId: msg.sessionId,
              fromParticipantId: 'server',
              sequence: 0,
              sentAt: new Date().toISOString(),
              payload: {
                code: 'NOT_IN_SESSION',
                message: 'Session not found',
                retryable: false,
              },
            } as any);
            break;
          }
          const peerId = session.participantAId === participantId ? session.participantBId : session.participantAId;
          try {
            // Rate limit offers/ICE per session
            if (msg.type === 'OFFER') {
              const { rateLimitStore } = await import('../db/in-memory');
              const rl = rateLimitStore.check(participantId, 'offersPerSession');
              if (!rl.allowed) throw new Error('RATE_LIMITED');
            }
            if (msg.type === 'ICE_CANDIDATE') {
              const { rateLimitStore } = await import('../db/in-memory');
              const rl = rateLimitStore.check(participantId, 'iceCandidatesPerSession');
              if (!rl.allowed) throw new Error('RATE_LIMITED');
            }

            await transport.send(peerId, msg);
          } catch {}
          break;
        }

        case 'SESSION_READY': {
          // Both peers acknowledge match — transition MATCHED -> CONNECTING or ACTIVE
          const session = sessionStore.get(msg.sessionId!);
          if (session && session.status === 'MATCHED') {
            // For TEXT mode, skip CONNECTING and go directly to ACTIVE
            if (session.mode === 'TEXT') {
              sessionStore.updateStatus(session.id, 'ACTIVE', null);
            } else {
              sessionStore.updateStatus(session.id, 'CONNECTING', null);
              // In production, wait for both SESSION_READY then ACTIVE
              // For simplicity, transition to ACTIVE after short delay
              setTimeout(() => {
                const s = sessionStore.get(session.id);
                if (s && s.status === 'CONNECTING') {
                  sessionStore.updateStatus(s.id, 'ACTIVE', null);
                }
              }, 500);
            }
          }
          // Relay to peer
          if (session) {
            const peerId = session.participantAId === participantId ? session.participantBId : session.participantAId;
            try {
              await transport.send(peerId, msg);
            } catch {}
          }
          break;
        }

        default:
          // Unknown type — already validated by parseSignalingMessage
          break;
      }
    }
  } catch (e) {
    console.error('[realtime] handler error', e);
  }
});

async function main() {
  await transport.start();
  console.log(`[realtime] listening on port ${PORT}`);

  // Graceful shutdown
  const shutdown = async () => {
    console.log('[realtime] shutting down...');
    await transport.stop();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

export { transport };
