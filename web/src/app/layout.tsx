import type { Metadata } from "next";
import { Exo_2 } from "next/font/google";
import "./globals.css";

const exo = Exo_2({
  variable: "--font-exo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "900"],
});

export const metadata: Metadata = {
  title: "NReader — Your library. Your way.",
  description:
    "A fast, private, cross-platform and open source manga library app. Unofficial and not affiliated with NHentai.",
  icons: {
    icon: "/app-icon.png",
  },
  other: {
    "theme-color": "#0b0b0b",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${exo.variable}`}>
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
