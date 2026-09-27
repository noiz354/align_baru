import Link from "next/link";

export default function SettingsPage() {
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
          <h1 style={{ fontSize: "24px", fontWeight: "bold" }}>Reader Settings</h1>
          <Link href="/" style={{ color: "#a1a1aa", textDecoration: "none", fontSize: "14px" }}>
            ← Back to Home
          </Link>
        </div>
      </header>

      <div style={{ maxWidth: "540px", backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: "8px", padding: "24px" }}>
        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", fontSize: "14px", fontWeight: "500", marginBottom: "8px" }}>
            Default Reading Mode
          </label>
          <select
            defaultValue="single"
            style={{
              width: "100%",
              backgroundColor: "#27272a",
              color: "#fff",
              border: "1px solid #3f3f46",
              padding: "8px 12px",
              borderRadius: "4px",
            }}
          >
            <option value="single">Single Page</option>
            <option value="double">Double Page (Spread)</option>
            <option value="vertical">Vertical Webtoon</option>
          </select>
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", fontSize: "14px", fontWeight: "500", marginBottom: "8px" }}>
            Reading Direction Preference
          </label>
          <select
            defaultValue="rtl"
            style={{
              width: "100%",
              backgroundColor: "#27272a",
              color: "#fff",
              border: "1px solid #3f3f46",
              padding: "8px 12px",
              borderRadius: "4px",
            }}
          >
            <option value="rtl">Right-to-Left (Manga default)</option>
            <option value="ltr">Left-to-Right (Western Comic default)</option>
          </select>
        </div>

        <div>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", cursor: "pointer" }}>
            <input type="checkbox" defaultChecked />
            Enable Tap-zone Navigation
          </label>
        </div>
      </div>
    </div>
  );
}
