import { loadSnapshot } from "@/lib/db/snapshot";
import { localToday } from "@/lib/engine/dates";
import { buildExport, exportFileName } from "@/lib/progress/export";

/** GET /api/export: every progress row as a versioned JSON download (src/lib/progress/export.ts). */
export async function GET(): Promise<Response> {
  try {
    const now = new Date();
    const snapshot = await loadSnapshot();
    const body = JSON.stringify(buildExport(snapshot, now), null, 2);
    return new Response(body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${exportFileName(localToday(now))}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[api/export]", err);
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
