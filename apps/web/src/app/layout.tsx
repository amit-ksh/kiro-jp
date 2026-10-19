import type { Metadata, Viewport } from "next";
import "@fontsource/lexend/400.css";
import "@fontsource/lexend/600.css";
import "@fontsource/lexend/700.css";
import "@fontsource/lexend/800.css";
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
    images: ["/media/j-image-main.webp"],
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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=Noto+Sans+JP:wght@400;500;700;900&family=Syne:wght@700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
