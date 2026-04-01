"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ACCENT = "#C9A96E";

export default function BottomNav() {
  const pathname = usePathname();
  const isDashboard = pathname.startsWith("/dashboard");
  const isCommunity = pathname.startsWith("/community");

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-white">
      <div className="mx-auto flex h-16 w-full max-w-[480px] items-center justify-center gap-10 px-6">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-sm"
          style={{ color: isDashboard ? ACCENT : "#737373" }}
        >
          <span aria-hidden>🏠</span>
          <span>Αρχική</span>
        </Link>
        <Link
          href="/community"
          className="flex items-center gap-2 text-sm"
          style={{ color: isCommunity ? ACCENT : "#737373" }}
        >
          <span aria-hidden>👥</span>
          <span>Κοινότητα</span>
        </Link>
      </div>
    </nav>
  );
}
