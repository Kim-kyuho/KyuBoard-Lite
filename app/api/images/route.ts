import { getDb } from "@/lib/db";
import { db_images } from "@/lib/db/schema";
import { NextRequest, NextResponse } from "next/server";

function isHttpUrl(value: unknown): value is string {
    if (typeof value !== "string") return false;

    try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch {
        return false;
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        if (
            !Number.isInteger(body.boardId) ||
            body.boardId <= 0 ||
            !isHttpUrl(body.url) ||
            !Number.isFinite(body.x) ||
            !Number.isFinite(body.y) ||
            !Number.isFinite(body.z) ||
            !Number.isFinite(body.width) ||
            !Number.isFinite(body.height) ||
            body.width <= 0 ||
            body.height <= 0 ||
            (body.label !== null && body.label !== undefined && typeof body.label !== "string")
        ) {
            return NextResponse.json({ ok: false, message: "Invalid image data." }, { status: 400 });
        }

        const db = getDb();
        const newImage = await db
            .insert(db_images)
            .values({
                boardId: body.boardId,
                url: body.url.trim(),
                label: body.label?.trim() || null,
                x: Math.round(body.x),
                y: Math.round(body.y),
                z: Math.round(body.z),
                width: Math.round(body.width),
                height: Math.round(body.height),
            })
            .returning();

        return NextResponse.json({ ok: true, image: newImage[0] }, { status: 201 });
    } catch (error) {
        console.error("Error creating image URL card:", error);
        return NextResponse.json(
            { ok: false, message: "The image URL could not be saved." },
            { status: 500 },
        );
    }
}
