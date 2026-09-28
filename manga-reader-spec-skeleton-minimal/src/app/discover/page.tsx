import Link from "next/link";
import { db } from "@/server/db/store";

export default function DiscoverPage() {
  const mangaList = db.getPublishedMangaList().map((m) => {
    const chapters = db.getPublishedChaptersByMangaId(m.id);
    return {
      id: m.slug,
      mangaId: m.id,
      title: m.title,
      author: m.author ?? "Spec Team",
      chapters: chapters.length,
      direction: m.readingDirection.toUpperCase(),
      firstChapter: chapters[0]?.chapterNumber ?? 1,
    };
  });

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#09090b",
        color: "#fafafa",
        padding: "32px",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <header style={{ marginBottom: "32px", borderBottom: "1px solid #27272a", paddingBottom: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ fontSize: "24px", fontWeight: "bold" }}>Discover Catalog</h1>
          <Link href="/" style={{ color: "#a1a1aa", textDecoration: "none", fontSize: "14px" }}>
            ← Back to Home
          </Link>
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "20px" }}>
        {mangaList.map((manga) => (
          <div
            key={manga.id}
            style={{
              backgroundColor: "#18181b",
              border: "1px solid #27272a",
              borderRadius: "8px",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div
                style={{
                  height: "160px",
                  backgroundColor: "#27272a",
                  borderRadius: "4px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "12px",
                  color: "#71717a",
                  fontSize: "14px",
                }}
              >
                Cover Art
              </div>
              <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "4px" }}>{manga.title}</h3>
              <p style={{ fontSize: "13px", color: "#a1a1aa", margin: "0 0 8px 0" }}>Author: {manga.author}</p>
              <div style={{ fontSize: "12px", color: "#71717a" }}>Direction: {manga.direction}</div>
            </div>

            <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ fontSize: "11px", color: "#71717a" }}>{manga.chapters} chapter{manga.chapters !== 1 ? "s" : ""} • {manga.firstChapter === 1 ? "Start at 1" : `Start ${manga.firstChapter}`}</div>
              <Link
                href={`/manga/${manga.id}/chapter/${manga.firstChapter}`}
                style={{
                  display: "block",
                  textAlign: "center",
                  backgroundColor: "#e11d48",
                  color: "#fff",
                  padding: "8px 12px",
                  borderRadius: "4px",
                  textDecoration: "none",
                  fontSize: "13px",
                  fontWeight: "500",
                }}
              >
                Read Chapter 1
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
