"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Leaves the organizer area only once the API has ended the session, so a shared device is safe. */
export function SignOutButton({ apiUrl }: { apiUrl: string }) {
  const t = useTranslations("organizer");
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function signOut() {
    setPending(true);
    setFailed(false);
    try {
      const response = await fetch(`${apiUrl}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
      // 401: the session had already ended.
      if (response.ok || response.status === 401) {
        window.location.assign("/organizer/login");
        return;
      }
    } catch {
      // Offline or API unreachable: the session is still open.
    }
    setFailed(true);
    setPending(false);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="outline" onClick={signOut} disabled={pending}>
        {t("signOut")}
      </Button>
      {failed && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {t("signOutFailed")}
        </p>
      )}
    </div>
  );
}
