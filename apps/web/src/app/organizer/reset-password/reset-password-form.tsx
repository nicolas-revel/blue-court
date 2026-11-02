"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { type FormEvent, useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/account-limits";

/**
 * Sets a new password from the emailed link. The token comes after `#`, which never reaches a
 * server, and is removed from the address bar once read.
 */
export function ResetPasswordForm({ apiUrl }: { apiUrl: string }) {
  const t = useTranslations("auth");
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const id = useId();

  useEffect(() => {
    setToken(window.location.hash.slice(1));
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const { password } = Object.fromEntries(new FormData(event.currentTarget));
      const response = await fetch(`${apiUrl}/auth/password-reset/confirm`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (response.ok) {
        window.location.assign("/organizer");
        return;
      }
      setError(
        t(response.status === 429 ? "errors.tooManyAttempts" : "reset.invalid", {
          min: PASSWORD_MIN_LENGTH,
        }),
      );
    } catch {
      setError(t("errors.network"));
    }
    setPending(false);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">{t("reset.title")}</h1>
      {token === "" ? (
        <p role="alert">{t("reset.missingLink")}</p>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={submit}>
          <div className="flex flex-col gap-1.5 text-sm">
            <label htmlFor={id} className="font-medium">
              {t("newPassword")}
            </label>
            <Input
              id={id}
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={PASSWORD_MIN_LENGTH}
              maxLength={PASSWORD_MAX_LENGTH}
            />
            <p className="text-muted-foreground">
              {t("passwordHint", { min: PASSWORD_MIN_LENGTH })}
            </p>
          </div>
          {error !== null && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" disabled={pending || token === null}>
            {t("reset.submit")}
          </Button>
        </form>
      )}
      <p className="text-sm text-muted-foreground">
        <Link className="underline" href="/organizer/forgot-password">
          {t("reset.askAgain")}
        </Link>
      </p>
    </main>
  );
}
