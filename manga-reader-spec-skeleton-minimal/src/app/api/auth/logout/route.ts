import { NextResponse } from "next/server";
import { db } from "@/server/db/store";

function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (!k) continue;
    out[k.trim()] = decodeURIComponent(v.join("=").trim());
  }
  return out;
}

export async function POST(req: Request) {
  const cookies = parseCookies(req.headers.get("cookie"));
  const token = cookies["session_token"];
  if (token) db.deleteSession(token);
  const res = NextResponse.json({ ok: true });
  res.cookies.set("session_token", "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}
