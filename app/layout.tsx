import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Life OS",
  description: "Personal development for Greek-speaking users",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="el">
      <body className="min-h-screen bg-white text-black antialiased">
        {children}
      </body>
    </html>
  );
}
