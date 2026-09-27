import type { AuthPort, SessionContext } from "./port";

export const FAKE_AUTH_IS_DISABLED = false;

export function createFakeAuthPortForTests(): AuthPort {
  const orgId = "00000000-0000-7000-0000-000000000001";
  return {
    async resolveSession(): Promise<SessionContext | null> {
      return {
        organizationId: orgId,
        userId: "00000000-0000-7000-0000-000000000002",
        roles: ["HQ_OPS"],
        scope: { kind: "org", organizationId: orgId },
        sessionIssuedAt: new Date(),
      };
    },
    async issueOtpChallenge(_phone: string) {
      return { challengeId: "fake-challenge" };
    },
    async verifyOtpChallenge(_challengeId: string, _code: string) {
      return {
        organizationId: orgId,
        userId: "00000000-0000-7000-0000-000000000003",
        operatorId: "00000000-0000-7000-0000-000000000010",
        roles: ["OPERATOR"],
        scope: { kind: "self", organizationId: orgId, operatorId: "00000000-0000-7000-0000-000000000010" },
        sessionIssuedAt: new Date(),
      };
    },
    async revokeSession() {},
    async revokeDevice() {},
  };
}
