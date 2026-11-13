import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

// Fetched by scripts/fetch-fonts.mjs before dev and build; never committed (see its header).
const switzer = localFont({
  src: [
    { path: "../assets/fonts/switzer/Switzer-400.woff2", weight: "400" },
    { path: "../assets/fonts/switzer/Switzer-500.woff2", weight: "500" },
  ],
  variable: "--font-switzer",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Snapmark: annotate to the pixel, then paste",
  description:
    "Open a screenshot, draw on it, and copy a PNG at the image's own size. Nothing leaves the browser.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${switzer.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
