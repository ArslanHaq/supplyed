import { themeBootScript } from "@/lib/theme-bootstrap";

/** Standalone forms use the same early theme initialization as the app layout. */
export function GET() {
  return new Response(themeBootScript, {
    headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
