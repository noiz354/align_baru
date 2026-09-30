import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import RecordingsLibraryPage from "../../src/app/recordings/page";

describe("recordings library availability boundary", () => {
  it("renders a clear informational notice without implying a library exists", () => {
    const html = renderToStaticMarkup(<RecordingsLibraryPage />);

    expect(html).toContain("Arsip rekaman");
    expect(html).toContain("Perpustakaan rekaman belum tersedia");
    expect(html).toContain("tidak mencari, membuka, atau memutar audio");
    expect(html).toContain("Perekaman mikrofon tetap dinonaktifkan");
  });

  it("exposes no audio, search, metadata, retention, or destructive controls", () => {
    const html = renderToStaticMarkup(<RecordingsLibraryPage />);

    expect(html).not.toMatch(/<(audio|video|form|input|button)\b/i);
    expect(html).not.toMatch(/recording[-_/ ]?(search|detail|delete|archive|playback)/i);
    expect(html).not.toContain("transcriptText");
    expect(html).not.toContain("recordingId");
  });

  it("links only to the existing informational recorder status page", () => {
    const html = renderToStaticMarkup(<RecordingsLibraryPage />);
    expect(html).toContain('href="/operator/recordings/new"');
  });
});
