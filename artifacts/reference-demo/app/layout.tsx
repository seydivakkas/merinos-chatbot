import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/app/providers";

export const metadata: Metadata = {
  title: "Merinos Dijital Asistan · Localhost Demo",
  description:
    "Ürün arama, sipariş takibi, satış noktası bulma ve SSS akışlarını içeren Merinos chatbot prototipi.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
