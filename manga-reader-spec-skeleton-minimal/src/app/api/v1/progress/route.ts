import { NextResponse } from "next/server";
import { db } from "@/server/db/store";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const chapterId = searchParams.get("chapterId");
  const userId = searchParams.get("userId") || "usr-guest-001";

  if (!chapterId) {
    return NextResponse.json({ code: "VALIDATION_FAILED", message: "chapterId is required." }, { status: 400 });
  }

  const prog = db.getProgress(userId, chapterId);
  if (!prog) {
    return NextResponse.json({ code: "NOT_FOUND", message: "Progress record not found." }, { status: 404 });
  }

  return NextResponse.json(prog);
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { chapterId, pageNumber, userId = "usr-guest-001" } = body;

    if (!chapterId || typeof pageNumber !== "number") {
      return NextResponse.json({ code: "VALIDATION_FAILED", message: "chapterId and pageNumber are required." }, { status: 400 });
    }

    const saved = db.saveProgress(userId, chapterId, pageNumber);
    return NextResponse.json(saved);
  } catch (err) {
    return NextResponse.json({ code: "INTERNAL_ERROR", message: "Failed to save progress." }, { status: 500 });
  }
}
