// HomeOps - feature skeleton (specification phase). Presentation shell only.

/**
 * The dashboard's first section: OPEN/ACKNOWLEDGED IMPORTANT and URGENT alerts only.
 * Contract: hidden when empty; individual critical items never collapsed; each row has exactly one
 * inline action; URGENT announced once with role="alert" (T-ALERT-014, T-ALERT-030).
 */

export type AttentionStripProps = {
  readonly items: readonly { readonly alertId: string; readonly title: string; readonly priority: string; readonly actionLabel: string }[];
};

export function AttentionStrip(_props: AttentionStripProps) {
  return null;
}
