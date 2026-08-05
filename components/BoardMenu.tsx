"use client";

import PressableButton from "./PressableButton";
import { Dispatch, SetStateAction } from "react";
import { EllipsisIcon } from "lucide-react";
import Link from "next/link";

type BoardMenuProps = {
    menuOpen: boolean;
    currentBoard: { title: string };
    setMenuOpen: Dispatch<SetStateAction<boolean>>;
    exportDisabled: boolean;
    transferring: boolean;
    onExport: () => void;
    onImport: () => void;
    onCompileMarkdown: () => void;
};

export default function BoardMenu({
    menuOpen,
    currentBoard,
    setMenuOpen,
    exportDisabled,
    transferring,
    onExport,
    onImport,
    onCompileMarkdown,
}: BoardMenuProps) {
    const runAndClose = (action: () => void) => {
        setMenuOpen(false);
        action();
    };

    return (
        <>
            <div className="fixed left-5 top-5 z-50000 rounded-xl bg-white/75 px-4 py-3 text-neutral-900 shadow-md">
                <Link
                    href="/"
                    className="font-mono text-1xl font-extrabold text-sky-500 transition duration-300 hover:text-pink-500 active:scale-105 active:rotate-1 sm:text-1xl"
                    style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none" }}
                >
                    •kyu.board
                </Link>
            </div>
            <PressableButton
                aria-label="Open board menu"
                className="fixed right-5 top-5 z-50000 bg-white/75 px-3 py-3 shadow-md"
                onClick={() => setMenuOpen((prev) => !prev)}
            >
                <EllipsisIcon className="h-5 w-5 text-neutral-900" />
            </PressableButton>
            {menuOpen && (
                <div className="fixed right-5 top-17 z-50000 w-56 rounded-xl bg-white/75 px-2 py-3 shadow-md">
                    <div className="px-3 py-2 font-bold text-neutral-900">{currentBoard.title}</div>
                    <PressableButton
                        variant="menu"
                        disabled={exportDisabled || transferring}
                        title={exportDisabled ? "Finish editing the current card or drawing before exporting." : "Export SQLite save file"}
                        className="font-bold text-sky-600 disabled:cursor-not-allowed disabled:opacity-35"
                        onClick={() => runAndClose(onExport)}
                    >
                        Export
                    </PressableButton>
                    <PressableButton
                        variant="menu"
                        disabled={transferring}
                        className="font-bold text-indigo-600 disabled:cursor-not-allowed disabled:opacity-35"
                        onClick={() => runAndClose(onImport)}
                    >
                        Import
                    </PressableButton>
                    <PressableButton
                        variant="menu"
                        className="font-bold text-pink-500"
                        onClick={() => runAndClose(onCompileMarkdown)}
                    >
                        Compile to Markdown
                    </PressableButton>
                    {exportDisabled && (
                        <p className="px-3 pt-2 text-xs font-semibold text-neutral-500">
                            Finish editing before exporting.
                        </p>
                    )}
                </div>
            )}
        </>
    );
}
