# Styles

`tokens.css` holds the design tokens (current content: type scale, spacing, colour placeholders,
Arabic-safe typography, touch-target sizes). Nothing else lives here yet.

Rules for whoever implements the design system (VS-1):

1. Components read tokens; a literal colour or size in a component is a review blocker.
2. Every token pair used for text must have a recorded contrast measurement (ACCESSIBILITY.md).
3. Large-text mode changes the base font size, not the components - that is why the sizes are rem-based.
4. `--font-family-arabic` must be a font stack that renders diacritics without clipping; the transcript
   reader depends on it (docs/transcription/CODE-SWITCHING.md §5).
5. No motion beyond a short fade; no auto-playing media; no decorative gradients (DESIGN.md: CALM).
