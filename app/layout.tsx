import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "KyuBoard Lite",
  description: "A local-first free-form board with portable SQLite save files.",
  icons: {
    icon: "/favicon.ico?v=2",
    apple: "/apple-touch-icon.png?v=2",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
