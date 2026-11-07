"use client";

import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-amber-100 px-4 py-2 text-center text-xs font-semibold text-amber-950 sm:text-sm print:hidden"
    >
      <WifiOff aria-hidden="true" size={16} />
      Vous êtes hors ligne : les modifications ne sont pas possibles.
    </div>
  );
}
