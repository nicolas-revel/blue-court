import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { currentOrganizer, publicApiUrl } from "@/lib/api";
import { SignOutButton } from "./sign-out-button";

/** The organizer area: visitors without a session are sent to the sign-in page. */
export default async function SignedInLayout({ children }: { children: ReactNode }) {
  const organizer = await currentOrganizer();
  if (organizer === null) redirect("/organizer/login");
  const t = await getTranslations("organizer");
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-8 px-4 py-8">
      <header className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">{t("signedInAs", { name: organizer.name })}</p>
        <SignOutButton apiUrl={publicApiUrl()} />
      </header>
      {children}
    </div>
  );
}
