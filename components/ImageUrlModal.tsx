"use client";

import { FormEvent, useState } from "react";
import PressableButton from "./PressableButton";

type ImageUrlModalProps = {
    onClose: () => void;
    onSubmit: (url: string, label: string) => Promise<boolean>;
};

export default function ImageUrlModal({ onClose, onSubmit }: ImageUrlModalProps) {
    const [url, setUrl] = useState("");
    const [label, setLabel] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setErrorMessage("");

        try {
            const parsedUrl = new URL(url.trim());
            if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
                throw new Error();
            }
        } catch {
            setErrorMessage("Enter a valid HTTP or HTTPS image URL.");
            return;
        }

        setSubmitting(true);
        const created = await onSubmit(url.trim(), label.trim());
        setSubmitting(false);
        if (created) onClose();
    };

    return (
        <div className="fixed inset-0 z-60000 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
            <form
                className="w-full max-w-lg rounded-xl bg-white p-5 text-neutral-900 shadow-xl"
                onSubmit={handleSubmit}
                onClick={(event) => event.stopPropagation()}
            >
                <h2 className="mb-4 text-lg font-bold">Add image URL</h2>
                <label className="mb-3 block text-sm font-semibold">
                    Image URL
                    <input
                        autoFocus
                        required
                        type="url"
                        value={url}
                        onChange={(event) => setUrl(event.target.value)}
                        placeholder="https://example.com/image.png"
                        className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 font-normal outline-none focus:border-sky-500"
                    />
                </label>
                <label className="block text-sm font-semibold">
                    Label (optional)
                    <input
                        value={label}
                        onChange={(event) => setLabel(event.target.value)}
                        placeholder="Image description"
                        className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 font-normal outline-none focus:border-sky-500"
                    />
                </label>
                {errorMessage && <p className="mt-3 text-sm font-semibold text-rose-600">{errorMessage}</p>}
                <div className="mt-5 flex justify-end gap-2">
                    <PressableButton type="button" className="px-4 py-2" onClick={onClose}>Cancel</PressableButton>
                    <PressableButton type="submit" disabled={submitting} className="bg-sky-500 px-4 py-2 text-white disabled:opacity-50">
                        {submitting ? "Adding..." : "Add image"}
                    </PressableButton>
                </div>
            </form>
        </div>
    );
}
