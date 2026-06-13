"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

const ACCENT = "#C9A96E";
const LOGOUT_RED = "#EF4444";

function LogoutDoorIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="shrink-0"
    >
      <g
        stroke={LOGOUT_RED}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </g>
    </svg>
  );
}

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const isDashboard = pathname.startsWith("/dashboard");
  const isCommunity = pathname.startsWith("/community");
  const isProgress = pathname.startsWith("/progress");

  async function onLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } finally {
      router.replace("/login");
      setLoggingOut(false);
    }
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-white">
      <div className="mx-auto flex h-16 w-full max-w-[480px] items-center justify-around gap-1 px-2 sm:px-4">
        <Link
          href="/dashboard"
          className="flex min-w-0 flex-1 flex-col items-center gap-0.5 text-[10px] sm:text-[11px] md:text-xs"
          style={{ color: isDashboard ? ACCENT : "#737373" }}
        >
          <span aria-hidden className="text-base leading-none">
            🏠
          </span>
          <span className="truncate">Αρχική</span>
        </Link>
        <Link
          href="/community"
          className="flex min-w-0 flex-1 flex-col items-center gap-0.5 text-[10px] sm:text-[11px] md:text-xs"
          style={{ color: isCommunity ? ACCENT : "#737373" }}
        >
          <span aria-hidden className="text-base leading-none">
            👥
          </span>
          <span className="truncate">Κοινότητα</span>
        </Link>
        <Link
          href="/progress"
          className="flex min-w-0 flex-1 flex-col items-center gap-0.5 text-[10px] sm:text-[11px] md:text-xs"
          style={{ color: isProgress ? ACCENT : "#737373" }}
        >
          <span aria-hidden className="text-base leading-none">
            📈
          </span>
          <span className="truncate">Πρόοδος</span>
        </Link>
        <button
          type="button"
          onClick={() => void onLogout()}
          disabled={loggingOut}
          className="flex min-w-0 flex-1 flex-col items-center gap-0.5 text-[10px] transition hover:opacity-90 disabled:opacity-60 sm:text-[11px] md:text-xs"
          style={{ color: LOGOUT_RED }}
          aria-label="Αποσύνδεση"
        >
          <span className="flex h-5 w-5 items-center justify-center leading-none">
            <LogoutDoorIcon />
          </span>
          <span className="truncate">Αποσύνδεση</span>
        </button>
      </div>
    </nav>
  );
}
