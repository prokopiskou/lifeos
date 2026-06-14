import type { Metadata, Viewport } from "next";
import "./globals.css";
import PathLetterModal from "@/components/PathLetterModal";

export const metadata: Metadata = {
  title: "Within OS",
  description: "Δεν χτίζουμε καλύτερες μέρες. Χτίζουμε ποιος είσαι μέσα τους.",
  appleWebApp: { capable: true, statusBarStyle: "black", title: "Within" },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
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
        <PathLetterModal />
      </body>
    </html>
  );
}
