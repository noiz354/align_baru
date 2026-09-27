/**
 * Type surface of the flat config, so `tests/unit/lint/**` can lint fixtures with the *same* config
 * `npm run lint` uses instead of a copy. Keep in sync with `eslint.config.mjs`.
 */
import type { Linter } from "eslint";

declare const config: Linter.Config[];
export default config;
