import type { Metadata, Viewport } from "next";
import "@fontsource/lexend/400.css";
import "@fontsource/lexend/500.css";
import "@fontsource/lexend/600.css";
import "@fontsource/lexend/700.css";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#37469E",
};

export const metadata: Metadata = {
  title: "Kiro JP — Learn, Understand, Use",
  description:
    "An Android Japanese-learning app connecting kanji recall, grammar patterns, and conversations around your interests.",
  keywords: [
    "Kiro JP",
    "Japanese learning app",
    "Kanji spaced repetition",
    "JLPT N5",
    "JLPT N4",
    "Qloo cultural context",
    "Android Japanese app",
  ],
  authors: [{ name: "Kiro JP Team" }],
  icons: {
    icon: "/kiro-mark.svg",
    apple: "/kiro-mark.svg",
  },
  openGraph: {
    title: "Kiro JP — Learn, Understand, Use",
    description:
      "Japanese learning through kanji components, grammar context, and interest-led conversations.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body>{children}</body>
    </html>
  );
}
