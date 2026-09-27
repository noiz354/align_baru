import Link from "next/link";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminMangaChaptersPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#09090b", color: "#fafafa", padding: "32px", fontFamily: "system-ui" }}>
      <header style={{ marginBottom: "24px" }}>
        <Link href="/admin/manga" style={{ color: "#a1a1aa", textDecoration: "none" }}>← Back to Manga List</Link>
        <h1 style={{ fontSize: "24px", marginTop: "12px" }}>Chapters for Manga: {id}</h1>
      </header>
      <div style={{ backgroundColor: "#18181b", padding: "20px", borderRadius: "8px", border: "1px solid #27272a" }}>
        <p style={{ color: "#a1a1aa" }}>Chapter sequence and publishing control for {id}.</p>
      </div>
    </div>
  );
}
