import { getDb } from "@/lib/db";
import { db_images } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

function isHttpUrl(value: unknown) {
    if (typeof value !== "string") return false;

    try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch {
        return false;
    }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const imageId = Number((await params).id);
        if (!Number.isInteger(imageId) || imageId <= 0) {
            return NextResponse.json({ ok: false, message: "Invalid image id." }, { status: 400 });
        }

        const body = await request.json();
        const updates: Partial<typeof db_images.$inferInsert> = {};

        if (body.boardId !== undefined) updates.boardId = body.boardId;
        if (body.url !== undefined) {
            if (!isHttpUrl(body.url)) {
                return NextResponse.json({ ok: false, message: "Invalid image URL." }, { status: 400 });
            }
            updates.url = body.url.trim();
        }
        if (body.label !== undefined) updates.label = typeof body.label === "string" ? body.label.trim() || null : null;
        if (body.x !== undefined) updates.x = Math.round(body.x);
        if (body.y !== undefined) updates.y = Math.round(body.y);
        if (body.z !== undefined) updates.z = Math.round(body.z);
        if (body.width !== undefined) updates.width = Math.round(body.width);
        if (body.height !== undefined) updates.height = Math.round(body.height);

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ ok: false, message: "No update fields were provided." }, { status: 400 });
        }

        const db = getDb();
        const updatedImage = await db
            .update(db_images)
            .set(updates)
            .where(eq(db_images.imageId, imageId))
            .returning();

        if (!updatedImage[0]) {
            return NextResponse.json({ ok: false, message: "Image does not exist." }, { status: 404 });
        }

        return NextResponse.json({ ok: true, image: updatedImage[0] });
    } catch (error) {
        console.error("Error updating image:", error);
        return NextResponse.json({ ok: false, message: "The image could not be updated." }, { status: 500 });
    }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const imageId = Number((await params).id);
        if (!Number.isInteger(imageId) || imageId <= 0) {
            return NextResponse.json({ ok: false, message: "Invalid image id." }, { status: 400 });
        }

        const db = getDb();
        const deletedImage = await db.delete(db_images).where(eq(db_images.imageId, imageId)).returning();
        if (!deletedImage[0]) {
            return NextResponse.json({ ok: false, message: "Image does not exist." }, { status: 404 });
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("Error deleting image:", error);
        return NextResponse.json({ ok: false, message: "The image could not be deleted." }, { status: 500 });
    }
}
