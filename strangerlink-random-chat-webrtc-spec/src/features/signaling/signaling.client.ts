/**
 * Signaling client — real implementation.
 *
 * Requirements:
 * - NFR-SEC-002, NFR-REL-001, NFR-SEC-004
 * - T-SIG-011, T-SESSION-END-015
 * - ADR-003, ADR-004
 */

import type { SignalingMessage } from '../../shared/contracts/signaling';

export const RECONNECT_WINDOW_MS = 15_000;
export const MAX_RECONNECT_ATTEMPTS = 5;
export const RECONNECT_BACKOFF_MS = 1000;

export interface SignalingClient {
  connect(token: string): Promise<void>;
  send(message: SignalingMessage): Promise<void>;
  close(): Promise<void>;
  onMessage(handler: (message: SignalingMessage) => void): void;
  onDisconnect(handler: (reason: string) => void): void;
  isConnected(): boolean;
}

export const createSignalingClient = (url: string): SignalingClient => {
  let ws: WebSocket | null = null;
  let messageHandler: ((msg: SignalingMessage) => void) | null = null;
  let disconnectHandler: ((reason: string) => void) | null = null;
  let reconnectAttempts = 0;
  let shouldReconnect = true;
  let token: string = '';
  let messageQueue: SignalingMessage[] = [];
  let sequence = 0;

  const connectInternal = (tkn: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = `${url}?token=${encodeURIComponent(tkn)}`;
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          reconnectAttempts = 0;
          // Flush queued messages
          for (const msg of messageQueue) {
            try {
              ws!.send(JSON.stringify(msg));
            } catch {}
          }
          messageQueue = [];
          resolve();
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data) as SignalingMessage;
            // Basic validation client-side
            if (!msg.type || !msg.messageId) return;
            messageHandler?.(msg);
          } catch {}
        };

        ws.onclose = (event) => {
          const reason = `closed:${event.code}:${event.reason}`;
          if (shouldReconnect && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            const delay = RECONNECT_BACKOFF_MS * Math.pow(2, reconnectAttempts) + Math.random() * 500;
            if (delay < RECONNECT_WINDOW_MS) {
              reconnectAttempts++;
              setTimeout(() => {
                connectInternal(token).catch(() => {});
              }, delay);
            } else {
              disconnectHandler?.(reason);
            }
          } else {
            disconnectHandler?.(reason);
          }
        };

        ws.onerror = () => {
          // Error will be followed by close
        };
      } catch (e) {
        reject(e);
      }
    });
  };

  return {
    async connect(tkn: string): Promise<void> {
      token = tkn;
      shouldReconnect = true;
      return connectInternal(tkn);
    },

    async send(message: SignalingMessage): Promise<void> {
      // Assign sequence if not set
      if (!message.sequence) {
        message.sequence = ++sequence;
      }
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      } else {
        // Queue for reconnect window
        messageQueue.push(message);
      }
    },

    async close(): Promise<void> {
      shouldReconnect = false;
      if (ws) {
        ws.close(1000, 'client-close');
        ws = null;
      }
    },

    onMessage(handler: (message: SignalingMessage) => void): void {
      messageHandler = handler;
    },

    onDisconnect(handler: (reason: string) => void): void {
      disconnectHandler = handler;
    },

    isConnected(): boolean {
      return ws !== null && ws.readyState === WebSocket.OPEN;
    },
  };
};

export const createNotImplementedSignalingClient = (url: string) => createSignalingClient(url);
