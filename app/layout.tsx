import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = "https://www.akiboard.jp";
const siteTitle =
  "AkiBoard(アキボード)｜今夜空いてる居酒屋・バーがすぐ見つかる【梅田】";
const siteDescription =
  "「今夜、急に飲みたい」をすぐ解決。梅田エリアの居酒屋・バー・ラーメン店などの当日空き状況をリアルタイムで確認できる無料サービス、AkiBoard(アキボード)。飛び込みOKのお店を今すぐ探せます。";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteTitle,
    template: "%s｜AkiBoard",
  },
  description: siteDescription,
  keywords: [
    "今夜 居酒屋 空き",
    "梅田 飲み屋 当日",
    "梅田 居酒屋 飛び込み",
    "当日 予約なし 飲食店",
    "梅田 2次会",
    "AkiBoard",
    "アキボード",
  ],
  applicationName: "AkiBoard",
  openGraph: {
    type: "website",
    locale: "ja_JP",
    url: siteUrl,
    siteName: "AkiBoard",
    title: siteTitle,
    description: siteDescription,
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
  },
  robots: {
    index: true,
    follow: true,
  },
  // Google Search Consoleで所有権確認コードを発行したら、下記のコメントを外して値を入れてください
  // verification: { google: "ここに確認用コードを貼る" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
