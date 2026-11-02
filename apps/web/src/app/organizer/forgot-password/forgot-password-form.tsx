"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { type FormEvent, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type State = "idle" | "pending" | "sent" | "tooManyAttempts" | "network";

/** Asks for a reset link. The answer never says whether the email has an account. */
export function ForgotPasswordForm({ apiUrl }: { apiUrl: string }) {
  const t = useTranslations("auth");
  const [state, setState] = useState<State>("idle");
  const id = useId();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("pending");
    try {
      const response = await fetch(`${apiUrl}/auth/password-reset`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))),
      });
      setState(response.status === 429 ? "tooManyAttempts" : "sent");
    } catch {
      setState("network");
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">{t("forgot.title")}</h1>
      {state === "sent" ? (
        <p role="status">{t("forgot.sent")}</p>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={submit}>
          <p className="text-sm text-muted-foreground">{t("forgot.intro")}</p>
          <div className="flex flex-col gap-1.5 text-sm">
            <label htmlFor={id} className="font-medium">
              {t("email")}
            </label>
            <Input id={id} name="email" type="email" autoComplete="email" required />
          </div>
          {(state === "tooManyAttempts" || state === "network") && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {t(`errors.${state}`)}
            </p>
          )}
          <Button type="submit" size="lg" disabled={state === "pending"}>
            {t("forgot.submit")}
          </Button>
        </form>
      )}
      <p className="text-sm text-muted-foreground">
        <Link className="underline" href="/organizer/login">
          {t("backToLogin")}
        </Link>
      </p>
    </main>
  );
}
