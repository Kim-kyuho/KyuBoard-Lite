import { createSaveFile } from "@/lib/db/save-file";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const saveFile = await createSaveFile();
        return new NextResponse(new Uint8Array(saveFile), {
            status: 200,
            headers: {
                "Content-Type": "application/vnd.sqlite3",
                "Content-Disposition": 'attachment; filename="kyuboard-lite.sqlite"',
                "Cache-Control": "no-store",
            },
        });
    } catch (error) {
        console.error("Error exporting board:", error);
        return NextResponse.json({ ok: false, message: "The board could not be exported." }, { status: 500 });
    }
}
