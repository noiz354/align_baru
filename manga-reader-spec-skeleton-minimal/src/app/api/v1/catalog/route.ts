import { NextResponse } from "next/server";
import { db } from "@/server/db/store";

export async function GET() {
  const manga = db.getPublishedMangaList();
  return NextResponse.json({
    items: manga.map((m) => ({
      id: m.id,
      slug: m.slug,
      title: m.title,
      description: m.description,
      readingDirection: m.readingDirection,
      author: m.author,
      artist: m.artist,
      status: m.status,
    })),
    total: manga.length,
  });
}
