import type { Metadata } from "next";
import "@fontsource/lexend/400.css";
import "@fontsource/lexend/600.css";
import "@fontsource/lexend/700.css";
import "@fontsource/lexend/800.css";
import "./globals.css";
export const metadata: Metadata = { title: "Kiro JP — Learn, use, return", description: "An Android Japanese-learning app connecting kanji, grammar and conversations around your interests.", robots: { index: false, follow: false } };
export default function Layout({ children }: { children: React.ReactNode }) { return <html lang="en"><body>{children}</body></html>; }
