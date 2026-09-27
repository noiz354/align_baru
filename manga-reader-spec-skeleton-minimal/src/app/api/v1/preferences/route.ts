import { NextResponse } from "next/server";
import { db } from "@/server/db/store";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId") || "usr-guest-001";
  const prefs = db.getPreferences(userId);
  return NextResponse.json(prefs);
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const userId = body.userId || "usr-guest-001";
    db.savePreferences({
      userId,
      mode: body.mode ?? "single",
      tapZonesEnabled: body.tapZonesEnabled ?? true,
      theme: body.theme ?? "dark",
      directionOverride: body.directionOverride,
      updatedAt: new Date().toISOString(),
    });
    return NextResponse.json(db.getPreferences(userId));
  } catch (err) {
    return NextResponse.json({ code: "INTERNAL_ERROR", message: "Failed to update preferences." }, { status: 500 });
  }
}
