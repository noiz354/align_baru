import { describe, it } from 'vitest';

// Layer and boundary assertions that CI enforces (docs/architecture/MODULE-MAP.md).
// These tests are the executable half of the module map.

describe.todo('module map: import boundaries hold');
//   it.todo('T-PLAT-006 structure: no file under src/domain imports react, next, or drizzle');
//   it.todo('T-PLAT-006 structure: no feature imports another feature');
//   it.todo('T-PLAT-006 structure: no feature imports src/server/db directly');
//   it.todo('T-PLAT-006 structure: src/shared has no imports from layers above it');
//   it.todo('T-PLAT-006 structure: the module graph is acyclic (cycle check over relative imports)');
//   it.todo('T-PLAT-006 structure: src/server/db/schema does not exist (schema lives in migrations, ARCHITECTURE.md section 9)');

// All suites are todo: no product logic exists yet, and tests are never weakened to pass
// (AGENTS.md section 8: not-implemented is correct; a fake implementation is not).
