"use client";

import React, { useState, useEffect, useCallback } from "react";
import type { ChapterManifest } from "../chapters/contracts";
import type { ReadingMode, ReadingDirection } from "../../shared/types/reader";
import { calculateReaderWindow } from "./ports";
import { displayIndex, stepPage, spreadFor, clamp } from "./reader-core";

interface ReaderViewProps {
  manifest: ChapterManifest;
  initialPage?: number;
}

export function ReaderView({ manifest, initialPage = 1 }: ReaderViewProps) {
  const totalPages = manifest.pages.length;
  const [direction, setDirection] = useState<ReadingDirection>(manifest.readingDirection);
  const [mode, setMode] = useState<ReadingMode>("single");
  const [currentPage, setCurrentPage] = useState<number>(clamp(initialPage, 1, totalPages));
  const [zoom, setZoom] = useState<number>(100);
  const [chromeVisible, setChromeVisible] = useState<boolean>(true);
  const [progressStatus, setProgressStatus] = useState<"idle" | "saving" | "saved">("idle");

  const windowRange = calculateReaderWindow({
    currentPage,
    totalPages,
    mode,
  });

  const currentDisplayIdx = displayIndex(currentPage, totalPages, direction);

  const navigate = useCallback((step: 1 | -1) => {
    setCurrentPage((prev) => {
      const next = stepPage(prev, step, totalPages, direction);
      return next;
    });
  }, [totalPages, direction]);

  // Keyboard navigation per FR-READER-004 & reader-behavior.md
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      switch (e.key) {
        case "ArrowRight":
          // In RTL: right arrow is previous page; in LTR: right arrow is next page
          navigate(direction === "rtl" ? -1 : 1);
          break;
        case "ArrowLeft":
          // In RTL: left arrow is next page; in LTR: left arrow is previous page
          navigate(direction === "rtl" ? 1 : -1);
          break;
        case "ArrowDown":
        case "PageDown":
        case " ":
          navigate(1);
          break;
        case "ArrowUp":
        case "PageUp":
          navigate(-1);
          break;
        case "Home":
          setCurrentPage(direction === "rtl" ? totalPages : 1);
          break;
        case "End":
          setCurrentPage(direction === "rtl" ? 1 : totalPages);
          break;
        case "m":
        case "M":
          setMode((m) => (m === "single" ? "double" : m === "double" ? "vertical" : "single"));
          break;
        case "d":
        case "D":
          setDirection((d) => (d === "rtl" ? "ltr" : "rtl"));
          break;
        case "h":
        case "H":
          setChromeVisible((v) => !v);
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [direction, navigate, totalPages]);

  // Save progress simulation
  useEffect(() => {
    setProgressStatus("saving");
    const timer = setTimeout(() => {
      setProgressStatus("saved");
    }, 300);
    return () => clearTimeout(timer);
  }, [currentPage]);

  // Generate SVG placeholder for pages (licensing-safe, no external assets)
  function renderPageCanvas(pageNum: number) {
    const isVisible = pageNum >= windowRange.start && pageNum <= windowRange.end;
    const pageObj = manifest.pages[pageNum - 1];
    const dispIdx = displayIndex(pageNum, totalPages, direction);

    return (
      <div
        key={pageNum}
        data-page-number={pageNum}
        data-display-index={dispIdx}
        style={{
          width: `${Math.round(480 * (zoom / 100))}px`,
          maxWidth: "100%",
          minHeight: `${Math.round(680 * (zoom / 100))}px`,
          backgroundColor: "#18181b",
          border: "1px solid #27272a",
          borderRadius: "4px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "#e4e4e7",
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.5)",
          position: "relative",
          margin: mode === "vertical" ? "12px auto" : "0",
        }}
      >
        {isVisible ? (
          <div style={{ textAlign: "center", padding: "20px" }}>
            <div style={{ fontSize: "14px", color: "#a1a1aa", marginBottom: "8px" }}>
              {manifest.title ?? "Licensed Manga"}
            </div>
            <div style={{ fontSize: "36px", fontWeight: "bold", color: "#f43f5e" }}>
              Page {dispIdx}
            </div>
            <div style={{ fontSize: "12px", color: "#71717a", marginTop: "4px" }}>
              (Physical #{pageNum} of {totalPages})
            </div>
            <div style={{ fontSize: "11px", color: "#52525b", marginTop: "16px", fontFamily: "monospace" }}>
              Key: {pageObj?.assetKey ?? "internal-key"}
            </div>
          </div>
        ) : (
          <div style={{ color: "#71717a", fontSize: "13px" }}>[Unloaded - Outside Active Window]</div>
        )}
      </div>
    );
  }

  // Active spread for double mode
  const currentSpread = spreadFor(currentPage, totalPages, direction);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        backgroundColor: "#09090b",
        color: "#fafafa",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Top Chrome / Header */}
      {chromeVisible && (
        <header
          style={{
            position: "sticky",
            top: 0,
            zIndex: 30,
            backgroundColor: "rgba(18, 18, 22, 0.95)",
            backdropFilter: "blur(8px)",
            borderBottom: "1px solid #27272a",
            padding: "10px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <span style={{ fontWeight: 600, fontSize: "15px" }}>{manifest.title}</span>
            <span style={{ marginLeft: "10px", fontSize: "12px", color: "#a1a1aa" }}>
              {progressStatus === "saving" ? "Saving..." : "Progress saved"}
            </span>
          </div>

          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            {/* Mode selection */}
            <label style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}>
              Mode:
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as ReadingMode)}
                style={{
                  backgroundColor: "#27272a",
                  color: "#fff",
                  border: "1px solid #3f3f46",
                  padding: "4px 8px",
                  borderRadius: "4px",
                }}
              >
                <option value="single">Single Page</option>
                <option value="double">Double Page</option>
                <option value="vertical">Vertical Webtoon</option>
              </select>
            </label>

            {/* Direction selection */}
            <label style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}>
              Dir:
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value as ReadingDirection)}
                style={{
                  backgroundColor: "#27272a",
                  color: "#fff",
                  border: "1px solid #3f3f46",
                  padding: "4px 8px",
                  borderRadius: "4px",
                }}
              >
                <option value="rtl">RTL (Manga)</option>
                <option value="ltr">LTR (Comic)</option>
              </select>
            </label>

            {/* Zoom */}
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <button
                type="button"
                onClick={() => setZoom((z) => clamp(z - 10, 50, 200))}
                style={{
                  backgroundColor: "#27272a",
                  color: "#fff",
                  border: "none",
                  padding: "4px 8px",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                -
              </button>
              <span style={{ fontSize: "12px", minWidth: "40px", textAlign: "center" }}>{zoom}%</span>
              <button
                type="button"
                onClick={() => setZoom((z) => clamp(z + 10, 50, 200))}
                style={{
                  backgroundColor: "#27272a",
                  color: "#fff",
                  border: "none",
                  padding: "4px 8px",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                +
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Reader Stage / Canvas */}
      <main
        style={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "20px 10px",
          overflowY: mode === "vertical" ? "auto" : "hidden",
        }}
        onClick={(e) => {
          // Click zones for touch/pointer (FR-READER-004): 25% left, 50% deadzone/chrome toggle, 25% right
          const rect = e.currentTarget.getBoundingClientRect();
          const clickXRatio = (e.clientX - rect.left) / rect.width;
          if (clickXRatio < 0.25) {
            navigate(direction === "rtl" ? 1 : -1);
          } else if (clickXRatio > 0.75) {
            navigate(direction === "rtl" ? -1 : 1);
          } else {
            setChromeVisible((v) => !v);
          }
        }}
      >
        {mode === "vertical" ? (
          <div style={{ display: "flex", flexDirection: "column", width: "100%", alignItems: "center" }}>
            {(direction === "rtl"
              ? Array.from({ length: totalPages }, (_, i) => totalPages - i)
              : Array.from({ length: totalPages }, (_, i) => i + 1)
            ).map((p) => renderPageCanvas(p))}
          </div>
        ) : mode === "double" ? (
          <div
            style={{
              display: "flex",
              flexDirection: direction === "rtl" ? "row-reverse" : "row",
              gap: "8px",
              justifyContent: "center",
            }}
          >
            {currentSpread.map((p) => renderPageCanvas(p))}
          </div>
        ) : (
          renderPageCanvas(currentPage)
        )}
      </main>

      {/* Bottom Chrome / Controls */}
      {chromeVisible && (
        <footer
          style={{
            position: "sticky",
            bottom: 0,
            zIndex: 30,
            backgroundColor: "rgba(18, 18, 22, 0.95)",
            backdropFilter: "blur(8px)",
            borderTop: "1px solid #27272a",
            padding: "12px 20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              onClick={() => navigate(-1)}
              style={{
                backgroundColor: "#27272a",
                color: "#fafafa",
                border: "1px solid #3f3f46",
                padding: "6px 14px",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => navigate(1)}
              style={{
                backgroundColor: "#e11d48",
                color: "#fff",
                border: "none",
                padding: "6px 14px",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              Next
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <input
              type="range"
              min={1}
              max={totalPages}
              value={currentDisplayIdx}
              onChange={(e) => {
                const disp = Number(e.target.value);
                const phys = direction === "rtl" ? totalPages - disp + 1 : disp;
                setCurrentPage(phys);
              }}
              style={{ cursor: "pointer", width: "140px" }}
              aria-label="Seek page"
            />
            <span style={{ fontSize: "14px", fontVariantNumeric: "tabular-nums" }}>
              Page {currentDisplayIdx} of {totalPages}
            </span>
          </div>

          <div style={{ fontSize: "12px", color: "#71717a" }}>
            Window: [{windowRange.start}..{windowRange.end}]
          </div>
        </footer>
      )}
    </div>
  );
}
