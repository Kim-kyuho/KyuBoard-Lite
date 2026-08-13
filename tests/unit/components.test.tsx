import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import BoardMenu from "@/components/BoardMenu";
import AboutModal from "@/components/AboutModal";
import BoardMessage from "@/components/BoardMessage";
import BoardToolBar from "@/components/BoardToolBar";
import ConfirmDialog from "@/components/ConfirmDialog";
import ImageUrlModal from "@/components/ImageUrlModal";
import PressableButton from "@/components/PressableButton";

describe("PressableButton", () => {
    it("applies and clears touch feedback while forwarding callbacks", () => {
        const onTouchStart = vi.fn();
        const onTouchEnd = vi.fn();
        render(<PressableButton onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>Action</PressableButton>);
        const button = screen.getByRole("button", { name: "Action" });

        fireEvent.touchStart(button);
        expect(button).toHaveClass("scale-[0.96]");
        expect(onTouchStart).toHaveBeenCalledOnce();

        fireEvent.touchEnd(button);
        expect(button).not.toHaveClass("scale-[0.96]");
        expect(onTouchEnd).toHaveBeenCalledOnce();
    });
});

describe("ConfirmDialog", () => {
    it("renders through a portal and dispatches confirm and cancel", () => {
        const onConfirm = vi.fn();
        const onCancel = vi.fn();
        render(<ConfirmDialog message="Delete card?" onConfirm={onConfirm} onCancel={onCancel} />);

        expect(screen.getByText("Delete card?")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Yes" }));
        fireEvent.click(screen.getByRole("button", { name: "No" }));
        expect(onConfirm).toHaveBeenCalledOnce();
        expect(onCancel).toHaveBeenCalledOnce();
    });
});

describe("Lite board controls", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("validates and submits an HTTP image URL", async () => {
        const onSubmit = vi.fn().mockResolvedValue(true);
        const onClose = vi.fn();
        render(<ImageUrlModal onClose={onClose} onSubmit={onSubmit} />);

        fireEvent.change(screen.getByLabelText("Image URL"), { target: { value: "ftp://example.com/image.png" } });
        fireEvent.click(screen.getByRole("button", { name: "Add image" }));
        expect(await screen.findByText(/valid HTTP or HTTPS/i)).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText("Image URL"), { target: { value: "https://example.com/image.png" } });
        fireEvent.change(screen.getByLabelText("Label (optional)"), { target: { value: " Example " } });
        fireEvent.click(screen.getByRole("button", { name: "Add image" }));
        await waitFor(() => expect(onSubmit).toHaveBeenCalledWith("https://example.com/image.png", "Example"));
        expect(onClose).toHaveBeenCalledOnce();
    });

    it("disables Export while a card is being edited", () => {
        render(<BoardMenu
            menuOpen
            currentBoard={{ title: "KyuBoard Lite" }}
            setMenuOpen={vi.fn()}
            exportDisabled
            transferring={false}
            onExport={vi.fn()}
            onImport={vi.fn()}
            onCompileMarkdown={vi.fn()}
            onAbout={vi.fn()}
        />);

        expect(screen.getByRole("button", { name: "Export" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Export" }).querySelector(".lucide-download")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Import" }).querySelector(".lucide-folder-open")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Compile to Markdown" }).querySelector(".lucide-file-text")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "About" }).querySelector(".lucide-info")).toBeInTheDocument();
        expect(screen.getByText("Finish editing before exporting.")).toBeVisible();
    });

    it("shows contact links in the About modal and closes with Escape", () => {
        const onClose = vi.fn();
        render(<AboutModal onClose={onClose} />);

        expect(screen.getByRole("dialog", { name: "About" })).toBeVisible();
        expect(screen.getByRole("link", { name: /Email:/ })).toHaveAttribute("href", "mailto:kgh9002@icloud.com");
        expect(screen.getByRole("link", { name: /GitHub:/ })).toHaveAttribute("href", "https://github.com/Kim-kyuho/");
        expect(screen.getByRole("link", { name: /Blog:/ })).toHaveAttribute("href", "https://kyulog.vercel.app");

        fireEvent.keyDown(document, { key: "Escape" });
        expect(onClose).toHaveBeenCalledOnce();
    });
});

describe("Beta board toolbar layout", () => {
    const renderToolbar = (cardEditing: boolean, drawingMode: boolean) => render(
        <BoardToolBar
            cardEditing={cardEditing}
            drawingMode={drawingMode}
            boardZoom={1}
            setBoardZoom={vi.fn()}
            setMenuOpen={vi.fn()}
            setSearchBarOpen={vi.fn()}
            onFocusPrevMemo={vi.fn()}
            onFocusNextMemo={vi.fn()}
            onMemoCreateClick={vi.fn()}
            onImageUploadClick={vi.fn()}
            onMermaidCreateClick={vi.fn()}
            onTableCreateClick={vi.fn()}
            onDrawingToggleClick={vi.fn()}
        />
    );

    it("keeps drawing start and finish in the separate lower-left control", () => {
        const { rerender } = renderToolbar(false, false);
        const startButton = screen.getByRole("button", { name: "Start drawing" });
        expect(startButton.parentElement).toHaveClass("bottom-10", "left-10");
        expect(startButton).toHaveClass("text-neutral-900");

        rerender(
            <BoardToolBar
                cardEditing
                drawingMode
                boardZoom={1}
                setBoardZoom={vi.fn()}
                setMenuOpen={vi.fn()}
                setSearchBarOpen={vi.fn()}
                onFocusPrevMemo={vi.fn()}
                onFocusNextMemo={vi.fn()}
                onMemoCreateClick={vi.fn()}
                onImageUploadClick={vi.fn()}
                onMermaidCreateClick={vi.fn()}
                onTableCreateClick={vi.fn()}
                onDrawingToggleClick={vi.fn()}
            />
        );

        const finishButton = screen.getByRole("button", { name: "Finish drawing" });
        expect(finishButton).toBeVisible();
        expect(finishButton).toHaveClass("text-neutral-900");
    });
});

describe("BoardMessage", () => {
    afterEach(() => vi.useRealTimers());

    it("dismisses a visible message after 3.5 seconds", () => {
        vi.useFakeTimers();
        const onDismiss = vi.fn();
        render(<BoardMessage type="memo" message="No memos exist." onDismiss={onDismiss} />);

        act(() => vi.advanceTimersByTime(3499));
        expect(onDismiss).not.toHaveBeenCalled();
        act(() => vi.advanceTimersByTime(1));
        expect(onDismiss).toHaveBeenCalledOnce();
    });
});
