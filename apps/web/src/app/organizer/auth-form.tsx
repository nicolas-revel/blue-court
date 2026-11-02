"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { type FormEvent, type ReactNode, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NAME_MAX_LENGTH, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/account-limits";

type Mode = "login" | "signup";

const ERRORS: Record<number, string> = {
  400: "invalid",
  401: "wrongCredentials",
  409: "emailTaken",
  429: "tooManyAttempts",
};

function Field(props: {
  id: string;
  label: string;
  hint?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <label htmlFor={props.id} className="font-medium">
        {props.label}
      </label>
      {props.children}
      {props.hint !== undefined && <p className="text-muted-foreground">{props.hint}</p>}
    </div>
  );
}

/** Sign-in and sign-up form. The API sets the session cookie, then the organizer area opens. */
export function AuthForm({ mode, apiUrl }: { mode: Mode; apiUrl: string }) {
  const t = useTranslations("auth");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const id = useId();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`${apiUrl}/auth/${mode}`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))),
      });
      if (response.ok) {
        // A full load, so the organizer area is rendered with the new cookie.
        window.location.assign("/organizer");
        return;
      }
      setError(t(`errors.${ERRORS[response.status] ?? "unknown"}`, { min: PASSWORD_MIN_LENGTH }));
    } catch {
      setError(t("errors.network"));
    }
    setPending(false);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">{t(`${mode}.title`)}</h1>
      <form className="flex flex-col gap-4" onSubmit={submit}>
        {mode === "signup" && (
          <Field id={`${id}-name`} label={t("name")}>
            <Input
              id={`${id}-name`}
              name="name"
              autoComplete="name"
              required
              maxLength={NAME_MAX_LENGTH}
            />
          </Field>
        )}
        <Field id={`${id}-email`} label={t("email")}>
          <Input id={`${id}-email`} name="email" type="email" autoComplete="email" required />
        </Field>
        <Field
          id={`${id}-password`}
          label={t("password")}
          hint={mode === "signup" ? t("passwordHint", { min: PASSWORD_MIN_LENGTH }) : undefined}
        >
          <Input
            id={`${id}-password`}
            name="password"
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            required
            minLength={mode === "signup" ? PASSWORD_MIN_LENGTH : undefined}
            maxLength={PASSWORD_MAX_LENGTH}
          />
        </Field>
        {error !== null && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" disabled={pending}>
          {t(`${mode}.submit`)}
        </Button>
      </form>
      <p className="text-sm text-muted-foreground">
        <Link
          className="underline"
          href={mode === "login" ? "/organizer/signup" : "/organizer/login"}
        >
          {t(`${mode}.switch`)}
        </Link>
      </p>
    </main>
  );
}
