import unittest

from tests.helpers import make_store
from src.infra.sync import SyncEngineWorker


class TestOutboxSync(unittest.TestCase):
    def test_drain_and_ack(self):
        store = make_store()
        store.enqueue_outbox("evt1", "VehicleCheckedIn", {"plate": "B 1234 ABC"})
        store.enqueue_outbox("evt2", "VehicleCheckedOut", {"plate": "B 1234 ABC"})

        pushed = []
        worker = SyncEngineWorker(store, push=lambda p: (pushed.append(p) or True))
        acked = worker.run_once()
        self.assertEqual(acked, 2)
        self.assertEqual(len(pushed), 2)
        self.assertEqual(len(store.pending_outbox()), 0)

    def test_network_failure_leaves_pending(self):
        store = make_store()
        store.enqueue_outbox("evt1", "VehicleCheckedIn", {"plate": "B 1234 ABC"})

        def flaky(p):
            raise RuntimeError("offline")

        worker = SyncEngineWorker(store, push=flaky)
        self.assertEqual(worker.run_once(), 0)
        self.assertEqual(len(store.pending_outbox()), 1)  # retried next time


if __name__ == "__main__":
    unittest.main()
