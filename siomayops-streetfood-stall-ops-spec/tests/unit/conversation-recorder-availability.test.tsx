import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ConversationRecorderPage from "@/app/operator/recordings/new/page";

describe("conversation recorder policy boundary", () => {
  it("renders an explicit unavailable state and does not offer capture, upload, or fabricated metadata controls", () => {
    const markup = renderToStaticMarkup(ConversationRecorderPage());
    expect(markup).toContain("Fitur belum tersedia");
    expect(markup).toContain("menolak akses mikrofon");
    expect(markup).toContain("tidak meminta izin mikrofon");
    expect(markup).toContain("Tidak ada transkrip");
    expect(markup).not.toMatch(/<(?:audio|video|form|input|button)\b/i);
  });
});
