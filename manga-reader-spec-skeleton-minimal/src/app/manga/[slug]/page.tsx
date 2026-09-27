import Link from "next/link";
import { SAMPLE_CHAPTER_MANIFEST } from "@/features/chapters/sample-data";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function MangaDetailPage({ params }: PageProps) {
  const { slug } = await params;

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
        <Link href="/discover" style={{ color: "#a1a1aa", textDecoration: "none", fontSize: "14px" }}>
          ← Back to Discover
        </Link>
        <h1 style={{ fontSize: "28px", fontWeight: "bold", marginTop: "12px" }}>The Licensed Adventure</h1>
        <p style={{ color: "#71717a", fontSize: "14px", marginTop: "4px" }}>Slug: {slug}</p>
      </header>

      <div style={{ maxWidth: "800px" }}>
        <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "16px" }}>Chapters</h2>
        <div style={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: "8px", overflow: "hidden" }}>
          <div
            style={{
              padding: "16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: "1px solid #27272a",
            }}
          >
            <div>
              <span style={{ fontWeight: 500 }}>{SAMPLE_CHAPTER_MANIFEST.title}</span>
              <span style={{ marginLeft: "12px", fontSize: "13px", color: "#71717a" }}>
                ({SAMPLE_CHAPTER_MANIFEST.pages.length} pages, {SAMPLE_CHAPTER_MANIFEST.readingDirection.toUpperCase()})
              </span>
            </div>
            <Link
              href={`/manga/${slug}/chapter/1`}
              style={{
                backgroundColor: "#e11d48",
                color: "#fff",
                padding: "6px 16px",
                borderRadius: "4px",
                textDecoration: "none",
                fontSize: "13px",
                fontWeight: 500,
              }}
            >
              Read
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
