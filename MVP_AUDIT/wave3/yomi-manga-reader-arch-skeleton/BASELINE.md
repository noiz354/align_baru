# Yomi Wave3 BASELINE

**Wave2 State:** `RUNNABLE_DEMO` (797b2c8) — catalog→manga→chapter→reader→progress via PGlite+FS, hard-coded `reader.demo@example.test` (594f4d49-f4b1-76a0-51f9-ccf8ccfca87c), page images via sharp, pglite:///tmp/yomi-pglite 49K + /tmp/yomi-storage 948K, progress 1→4 reload 4 restart 4 but not per-user.

**Demo-only boundary:** progress/library/bookmark belong to deterministic demo user, no auth, no per-user isolation, no login/logout, no negative paths.

**Wave3 target:** authenticated reader→per-user library→bookmark→progress→logout/login→state restored, User A vs User B isolation, 3 negative paths, restart durability, promotion `RUNNABLE_DEMO→MVP_PARTIAL`.
