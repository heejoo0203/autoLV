import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "autoLV Web",
  description: "개별공시지가 조회 서비스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
