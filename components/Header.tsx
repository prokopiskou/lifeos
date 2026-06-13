import LogoutButton from "@/components/LogoutButton";

const ACCENT = "#C9A96E";

export default function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-black/10 bg-white">
      <div className="mx-auto flex h-14 w-full max-w-[480px] items-center justify-between px-6">
        <span className="text-base font-semibold" style={{ color: ACCENT }}>
          Life OS
        </span>
        <LogoutButton className="text-sm text-neutral-500 transition hover:text-neutral-700 disabled:opacity-60" />
      </div>
    </header>
  );
}
