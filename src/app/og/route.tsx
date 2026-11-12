import { ImageResponse } from "next/og";
import { PREVIEW_IMAGE } from "@/server/link-preview";

/**
 * GET /og: Pencil's preview card, used by link previews for pages without a
 * cover image of their own. It never changes, so it's built once and cached.
 */
export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          color: "#FBF4E8",
          backgroundColor: "#A64A26",
          backgroundImage:
            "radial-gradient(circle at 78% 18%, rgba(240,178,128,0.55), transparent 45%), radial-gradient(circle at 12% 90%, rgba(80,30,14,0.55), transparent 50%), linear-gradient(150deg, #9A3E1F, #BC5A2F)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="64" height="64" viewBox="0 0 24 24">
            <path d="M12 2 20 12 12 22 4 12z" fill="#F3C9A2" />
            <path d="M12 6.5v8" stroke="#A64A26" strokeWidth="1.6" />
            <circle cx="12" cy="15.6" r="1.5" fill="#A64A26" />
          </svg>
          <span style={{ fontSize: 56, letterSpacing: "-0.02em" }}>Pencil</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <span style={{ fontSize: 96, lineHeight: 1.02, letterSpacing: "-0.03em", maxWidth: 900 }}>
            Ideas worth slowing down for.
          </span>
          <span style={{ fontSize: 30, color: "rgba(251,244,232,0.85)" }}>
            Essays, notes and long thoughts from writers you&apos;ll come back to.
          </span>
        </div>
      </div>
    ),
    { width: PREVIEW_IMAGE.width, height: PREVIEW_IMAGE.height },
  );
}
