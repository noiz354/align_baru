import { db } from "@/server/db/store";

export function parseCookies(cookieHeader: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (!k) continue;
    out[k.trim()] = decodeURIComponent(v.join("=").trim());
  }
  return out;
}

export function getSessionUser(req: Request): { id: string; email: string; role: string } | null {
  const cookies = parseCookies(req.headers.get("cookie"));
  const token = cookies["session_token"];
  if (!token) return null;
  const sess = db.getSessionByToken(token);
  if (!sess) return null;
  const user = db.getUserById(sess.userId);
  if (!user) return null;
  return { id: user.id, email: user.email, role: user.role };
}

export function requireUser(req: Request): { id: string; email: string; role: string } {
  const u = getSessionUser(req);
  if (!u) {
    throw Object.assign(new Error("AUTH_REQUIRED"), { status: 401, code: "AUTH_REQUIRED" });
  }
  return u;
}
