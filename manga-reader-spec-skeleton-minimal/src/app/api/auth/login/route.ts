import { NextResponse } from "next/server";
import { db } from "@/server/db/store";

export async function POST(req: Request) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ code: "VALIDATION_FAILED", message: "Body must be JSON" }, { status: 400 }); }
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!email || !password) return NextResponse.json({ code: "VALIDATION_FAILED", message: "email and password required" }, { status: 400 });
  const user = db.findUserByEmail(email);
  // timing uniformity: verify dummy even if not found
  if (!user) {
    // do dummy verify to not leak timing
    db.verifyUserPassword({ id: "", email: "", role: "reader", passwordHash: db["users"]?.values()?.next?.()?.value?.passwordHash } as any, password);
    return NextResponse.json({ code: "AUTH_FAILED", message: "Email atau password salah" }, { status: 401 });
  }
  if (!db.verifyUserPassword(user, password)) {
    return NextResponse.json({ code: "AUTH_FAILED", message: "Email atau password salah" }, { status: 401 });
  }
  const sess = db.createSession(user.id);
  const res = NextResponse.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role }, sessionToken: sess.token });
  res.cookies.set("session_token", sess.token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
  return res;
}
