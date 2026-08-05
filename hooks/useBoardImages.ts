import { RefObject, useState } from "react";

export type BoardImage = {
    imageId: number;
    boardId: number;
    url: string;
    label: string | null;
    x: number;
    y: number;
    z: number;
    width: number;
    height: number;
};

type UseBoardImagesOptions = {
    initialImages: BoardImage[];
    boardId: number;
    boardZoom: number;
    cardLocationRef: RefObject<HTMLDivElement | null>;
    setMessage: (message: string) => void;
};

const getImageSize = (url: string) =>
    new Promise<{ width: number; height: number }>((resolve) => {
        const image = new Image();
        let settled = false;
        const finish = (width = 400, height = 300) => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timeoutId);
            const scale = Math.min(400 / width, 300 / height, 1);
            resolve({
                width: Math.max(1, Math.round(width * scale)),
                height: Math.max(1, Math.round(height * scale)),
            });
        };

        image.onload = () => finish(image.naturalWidth, image.naturalHeight);
        image.onerror = () => finish();
        const timeoutId = window.setTimeout(() => finish(), 5000);
        image.src = url;
    });

export function useBoardImages({
    initialImages,
    boardId,
    boardZoom,
    cardLocationRef,
    setMessage,
}: UseBoardImagesOptions) {
    const [images, setImages] = useState(initialImages);
    const [editingImageId, setEditingImageId] = useState<number | null>(null);
    const [imageUrlOpen, setImageUrlOpen] = useState(false);

    const handleCreateImage = async (url: string, label: string) => {
        const locationElement = cardLocationRef.current;
        const { width, height } = await getImageSize(url);
        const x = locationElement
            ? Math.max(0, (locationElement.scrollLeft + locationElement.clientWidth / 2) / boardZoom - width / 2)
            : 0;
        const y = locationElement
            ? Math.max(0, (locationElement.scrollTop + locationElement.clientHeight / 2) / boardZoom - height / 2)
            : 0;

        const response = await fetch("/api/images", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                boardId,
                url,
                label: label || null,
                x: Math.round(x),
                y: Math.round(y),
                z: 1,
                width,
                height,
            }),
        });
        const data = await response.json();

        if (!response.ok || !data.ok) {
            setMessage(data.message ?? "The image URL could not be saved.");
            return false;
        }

        setImages((prev) => [...prev, data.image]);
        setEditingImageId(data.image.imageId);
        return true;
    };

    const handleUpdateImage = async (
        imageId: number,
        boardId: number,
        url: string,
        label: string | null,
        x: number,
        y: number,
        z: number,
        width: number,
        height: number,
    ) => {
        const response = await fetch(`/api/images/${imageId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ boardId, url, label, x, y, z, width, height }),
        });
        const data = await response.json();

        if (!response.ok || !data.ok) {
            setMessage(data.message ?? "The image could not be updated.");
            return;
        }

        setImages((prev) => prev.map((image) => image.imageId === imageId
            ? { ...image, boardId, url, label, x, y, z, width, height }
            : image));
    };

    const handleDeleteImage = async (imageId: number) => {
        const response = await fetch(`/api/images/${imageId}`, { method: "DELETE" });
        const data = await response.json();

        if (!response.ok || !data.ok) {
            setMessage(data.message ?? "The image could not be deleted.");
            return;
        }

        setImages((prev) => prev.filter((image) => image.imageId !== imageId));
        setEditingImageId(null);
    };

    return {
        images,
        setImages,
        editingImageId,
        setEditingImageId,
        imageUrlOpen,
        setImageUrlOpen,
        handleCreateImage,
        handleUpdateImage,
        handleDeleteImage,
    };
}
