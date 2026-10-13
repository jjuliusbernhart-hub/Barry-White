"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function SyncButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function synchronize() {
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/quickbooks/sync", { method: "POST" });
      const body = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(body.error ?? "Synchronisation fehlgeschlagen.");
      }

      router.refresh();
    } catch (syncError) {
      setError(
        syncError instanceof Error
          ? syncError.message
          : "Synchronisation fehlgeschlagen.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={synchronize}
        disabled={pending}
        className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#1d4b31] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#153b27] disabled:cursor-wait disabled:opacity-70"
      >
        <RefreshCw className={`size-4 ${pending ? "animate-spin" : ""}`} />
        {pending ? "Synchronisiert …" : "Jetzt synchronisieren"}
      </button>
      {error && (
        <div className="absolute right-0 top-12 z-20 w-72 rounded-xl border border-red-200 bg-white p-3 text-xs font-medium text-red-700 shadow-lg">
          {error}
        </div>
      )}
    </div>
  );
}
