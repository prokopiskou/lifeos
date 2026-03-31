import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="max-w-md text-center">
        <h1 className="text-4xl font-semibold tracking-tight">Life OS</h1>
        <p className="mt-4 text-neutral-600">
          Προσωπική ανάπτυξη, οργανωμένη σε ένα μέρος.
        </p>
        <Link
          href="/signup"
          className="mt-10 inline-block rounded-md border border-black bg-black px-6 py-3 text-sm font-medium text-white transition hover:bg-neutral-900"
        >
          Get Started
        </Link>
      </div>
    </main>
  );
}
