import { ChangeEvent, useRef, useState } from "react";

type UseBoardTransferOptions = {
    exportDisabled: boolean;
    setMessage: (message: string) => void;
};

async function getErrorMessage(response: Response, fallback: string) {
    const data = await response.json().catch(() => null);
    return data?.message ?? fallback;
}

export function useBoardTransfer({ exportDisabled, setMessage }: UseBoardTransferOptions) {
    const importInputRef = useRef<HTMLInputElement | null>(null);
    const [transferring, setTransferring] = useState(false);

    const handleExport = async () => {
        if (exportDisabled || transferring) return;

        setTransferring(true);
        try {
            const response = await fetch("/api/save/export");
            if (!response.ok) {
                setMessage(await getErrorMessage(response, "The board could not be exported."));
                return;
            }

            const file = await response.blob();
            const fileUrl = URL.createObjectURL(file);
            const downloadLink = document.createElement("a");
            downloadLink.href = fileUrl;
            downloadLink.download = "kyuboard-lite.sqlite";
            document.body.appendChild(downloadLink);
            downloadLink.click();
            downloadLink.remove();
            URL.revokeObjectURL(fileUrl);
        } catch {
            setMessage("The board could not be exported.");
        } finally {
            setTransferring(false);
        }
    };

    const handleImportClick = () => {
        if (!transferring) importInputRef.current?.click();
    };

    const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;

        const confirmed = window.confirm(
            "Importing this save file will replace the current board. Continue?",
        );
        if (!confirmed) return;

        setTransferring(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            const response = await fetch("/api/save/import", { method: "POST", body: formData });
            if (!response.ok) {
                setMessage(await getErrorMessage(response, "The save file could not be imported."));
                return;
            }

            window.location.reload();
        } catch {
            setMessage("The save file could not be imported.");
        } finally {
            setTransferring(false);
        }
    };

    return {
        importInputRef,
        transferring,
        handleExport,
        handleImportClick,
        handleImport,
    };
}
