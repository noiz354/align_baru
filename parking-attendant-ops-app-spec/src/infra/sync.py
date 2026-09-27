"""
Offline-first Outbox Sync Worker (OFFLINE.md).

Every domain mutation is already written to ``outbox_events`` in the same local
SQLite transaction (see ``SqliteParkingStore``). This worker drains the PENDING
queue in batches and acknowledges events once the (simulated) cloud hub accepts
them. Network failure simply leaves the event PENDING for the next attempt.
"""

from typing import Callable, List


class SyncEngineWorker:
    def __init__(self, store, push: Callable[[dict], bool], batch_size: int = 50):
        self.store = store
        self.push = push  # returns True on successful cloud ACK
        self.batch_size = batch_size

    def run_once(self) -> int:
        pending = self.store.pending_outbox(self.batch_size)
        acked: List[str] = []
        for event in pending:
            try:
                if self.push(event["payload"]):
                    acked.append(event["event_id"])
            except Exception:
                # Leave PENDING; retry on next run (zero data loss offline-first).
                continue
        if acked:
            self.store.acknowledge_outbox(acked)
        return len(acked)
