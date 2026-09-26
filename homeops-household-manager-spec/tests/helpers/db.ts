// HomeOps - test harness skeleton (specification phase).

/**
 * Integration harness contract (docs/testing/TEST-DATA.md sections 5 and 10):
 *  - create a scratch database per worker and migrate it once;
 *  - truncate in dependency order between tests, or wrap a test in a rolled-back transaction;
 *  - apply the fixture households HH_MAIN, HH_CONTROL, HH_WIDTH, HH_EMPTY, HH_BUSY;
 *  - never connect to a database whose name does not contain "test" or "dev".
 *
 * Owning task: T-PLAT-016.
 */
export async function withScratchDatabase<T>(_fn: () => Promise<T>): Promise<T> {
  throw new Error('Not implemented: T-PLAT-016');
}

export async function resetFixtures(): Promise<void> {
  throw new Error('Not implemented: T-PLAT-016');
}
