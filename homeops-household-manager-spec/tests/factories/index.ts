// HomeOps - test factory contract (specification phase).

/**
 * Factories build valid domain objects with explicit, asserted defaults
 * (docs/testing/TEST-DATA.md section 4). They never touch the database; persistence belongs to the
 * integration layer. Real implementations land with the first slice that needs them (VS-1).
 */

export type FactoryOverrides<T> = Partial<T>;

export function household(_overrides?: FactoryOverrides<unknown>): never {
  throw new Error('Not implemented: T-PLAT-016');
}

export function member(_overrides?: FactoryOverrides<unknown>): never {
  throw new Error('Not implemented: T-PLAT-016');
}

export function choreOccurrence(_overrides?: FactoryOverrides<unknown>): never {
  throw new Error('Not implemented: T-PLAT-016');
}

export function resource(_overrides?: FactoryOverrides<unknown>): never {
  throw new Error('Not implemented: T-PLAT-016');
}
