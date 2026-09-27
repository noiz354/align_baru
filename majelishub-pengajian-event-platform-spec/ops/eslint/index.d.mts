/**
 * Type surface of the project's own ESLint plugin, so TypeScript tests can import the `.mjs` rules
 * without enabling `allowJs` for production code. Keep in sync with `ops/eslint/index.mjs`.
 * Owning tasks: T-ARCH-002, T-ARCH-003, T-SEC-004.
 */
export interface MajelishubRuleModule {
  readonly meta: {
    readonly type: string;
    readonly docs?: { readonly description?: string };
    readonly schema?: readonly unknown[];
    readonly messages?: Readonly<Record<string, string>>;
  };
  // The context/AST types come from ESLint at runtime; tests only need an opaque handle.
  create(context: never): Record<string, (node: never) => void>;
}

export declare const majelishubPlugin: {
  readonly meta: { readonly name: string; readonly version: string };
  readonly rules: {
    readonly "module-boundaries": MajelishubRuleModule;
    readonly "no-fake-implementation": MajelishubRuleModule;
    readonly "no-token-logging": MajelishubRuleModule;
  };
};

export default majelishubPlugin;
