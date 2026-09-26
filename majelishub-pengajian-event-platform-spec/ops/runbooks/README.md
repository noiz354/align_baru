# Deployment-specific runbooks

The canonical procedures live in `RUNBOOK.md` at the repository root (RB-01...RB-18). This directory is
where a **deployment** keeps its own filled-in copies: hostnames, phone numbers of the responsible
people, secret-store locations, the sealed break-glass holder names, and any local deviations.

Rules:

1. Never commit secrets here - only where to find them and who can reach them.
2. Keep the deployment notes current: `OPERATIONS.md` §9 requires them to exist outside the repository
   in an agreed location, with a copy of the sequence here for the operator.
3. A drill without a written record did not happen: record date, people, duration, what failed and what
   changed as a result.
