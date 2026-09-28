import { NextResponse } from "next/server";
import { db } from "@/server/db/store";
import { requireUser, getSessionUser } from "@/server/auth/guard";

export async function GET(req: Request) {
  const user = getSessionUser(req);
  if (!user) return NextResponse.json({ code: "AUTH_REQUIRED", message: "Silakan login terlebih dahulu" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const chapterId = searchParams.get("chapterId");
  if (!chapterId) {
    return NextResponse.json({ code: "VALIDATION_FAILED", message: "chapterId is required." }, { status: 400 });
  }
  // tenant isolation: ignore any userId param
  const prog = db.getProgress(user.id, chapterId);
  if (!prog) {
    return NextResponse.json({ code: "NOT_FOUND", message: "Progress record not found." }, { status: 404 });
  }
  return NextResponse.json(prog);
}

export async function PUT(req: Request) {
  const user = getSessionUser(req);
  if (!user) return NextResponse.json({ code: "AUTH_REQUIRED", message: "Silakan login terlebih dahulu" }, { status: 401 });
  try {
    const body = await req.json();
    const chapterId = typeof body?.chapterId === "string" ? body.chapterId.trim() : "";
    const pageNumberRaw = body?.pageNumber;
    const pageNumber = typeof pageNumberRaw === "number" ? pageNumberRaw : Number(pageNumberRaw);

    if (!chapterId || !Number.isFinite(pageNumber) || !Number.isInteger(pageNumber)) {
      return NextResponse.json({ code: "VALIDATION_FAILED", message: "chapterId and integer pageNumber are required." }, { status: 400 });
    }
    if (pageNumber < 1) {
      return NextResponse.json({ code: "VALIDATION_FAILED", message: "pageNumber must be >=1", fields: { pageNumber: "minimal 1" } }, { status: 422 });
    }
    const chapter = db.getChapter(chapterId);
    if (!chapter) return NextResponse.json({ code: "NOT_FOUND", message: "Chapter tidak ditemukan" }, { status: 404 });
    if (pageNumber > chapter.pageCount) {
      return NextResponse.json({ code: "VALIDATION_FAILED", message: `Page out of range 1..${chapter.pageCount}`, fields: { pageNumber: `maksimal ${chapter.pageCount}` } }, { status: 422 });
    }
    // ignore any userId in body
    const saved = db.saveProgress(user.id, chapterId, pageNumber);
    return NextResponse.json(saved);
  } catch (err: any) {
    if (err?.code === "AUTH_REQUIRED") return NextResponse.json({ code: "AUTH_REQUIRED", message: err.message }, { status: 401 });
    return NextResponse.json({ code: "INTERNAL_ERROR", message: "Failed to save progress." }, { status: 500 });
  }
}
