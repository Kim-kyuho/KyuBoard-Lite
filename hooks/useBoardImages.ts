import { RefObject, useState } from "react";
import { nextPositiveId, type BoardImage } from "@/lib/board-state";

export type { BoardImage } from "@/lib/board-state";

type UseBoardImagesOptions = {
    initialImages: BoardImage[];
    boardId: number;
    boardZoom: number;
    cardLocationRef: RefObject<HTMLDivElement | null>;
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

        const imageId = nextPositiveId(images.map((image) => image.imageId));
        setImages((prev) => [...prev, {
            imageId,
            boardId,
            url,
            label: label || null,
            x: Math.round(x),
            y: Math.round(y),
            z: 1,
            width,
            height,
        }]);
        setEditingImageId(imageId);
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
        setImages((prev) => prev.map((image) => image.imageId === imageId
            ? { ...image, boardId, url, label, x, y, z, width, height }
            : image));
    };

    const handleDeleteImage = async (imageId: number) => {
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
