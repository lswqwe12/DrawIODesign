import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI辅助UML设计工具",
  description: "带AI辅助功能的UML设计工具网页应用",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
