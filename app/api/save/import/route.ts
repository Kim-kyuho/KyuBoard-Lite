import { importSaveFile } from "@/lib/db/save-file";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
const maxSaveFileSize = 50 * 1024 * 1024;

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get("file");
        if (!(file instanceof File) || file.size === 0) {
            return NextResponse.json({ ok: false, message: "A SQLite save file is required." }, { status: 400 });
        }
        if (file.size > maxSaveFileSize) {
            return NextResponse.json({ ok: false, message: "The save file must be 50 MB or smaller." }, { status: 413 });
        }

        importSaveFile(Buffer.from(await file.arrayBuffer()));
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("Error importing board:", error);
        const message = error instanceof Error ? error.message : "The save file could not be imported.";
        return NextResponse.json({ ok: false, message }, { status: 400 });
    }
}
