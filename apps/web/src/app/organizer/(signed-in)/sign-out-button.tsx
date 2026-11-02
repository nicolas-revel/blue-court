"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function SignOutButton({ apiUrl }: { apiUrl: string }) {
  const t = useTranslations("organizer");
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    try {
      await fetch(`${apiUrl}/auth/logout`, { method: "POST", credentials: "include" });
    } finally {
      window.location.assign("/organizer/login");
    }
  }

  return (
    <Button variant="outline" onClick={signOut} disabled={pending}>
      {t("signOut")}
    </Button>
  );
}
