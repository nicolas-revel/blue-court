import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import * as apiLimits from "../../../../api/src/auth/limits";
import fr from "../../../messages/fr.json";
import * as limits from "../../lib/account-limits";
import { TournamentList } from "./(signed-in)/tournament-list";
import { AuthForm } from "./auth-form";
import { ForgotPasswordForm } from "./forgot-password/forgot-password-form";
import { ResetPasswordForm } from "./reset-password/reset-password-form";

const render = (node: ReactNode) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="fr" messages={fr}>
      {node}
    </NextIntlClientProvider>,
  );

describe("sign-in and sign-up forms", () => {
  it("signs in with an email and a password", () => {
    const html = render(<AuthForm mode="login" apiUrl="http://api" />);
    expect(html).toContain(fr.auth.login.title);
    expect(html).toContain('"current-password"');
    expect(html).not.toContain('name="name"');
    expect(html).toContain('href="/organizer/signup"');
  });

  it("asks for a name and a long enough new password to sign up", () => {
    const html = render(<AuthForm mode="signup" apiUrl="http://api" />);
    expect(html).toContain(fr.auth.signup.title);
    expect(html).toContain('name="name"');
    expect(html).toContain('"new-password"');
    expect(html).toContain(`minLength="${limits.PASSWORD_MIN_LENGTH}"`);
    expect(html).toContain(`${limits.PASSWORD_MIN_LENGTH} caractères minimum`);
  });

  it("uses the API's field limits", () => {
    expect(limits).toEqual(apiLimits);
  });
});

describe("forgotten password", () => {
  it("is offered from the sign-in form", () => {
    expect(render(<AuthForm mode="login" apiUrl="http://api" />)).toContain(
      'href="/organizer/forgot-password"',
    );
    expect(render(<AuthForm mode="signup" apiUrl="http://api" />)).not.toContain("forgot-password");
  });

  it("asks for the email, then for a new password long enough", () => {
    expect(render(<ForgotPasswordForm apiUrl="http://api" />)).toContain(fr.auth.forgot.submit);
    const html = render(<ResetPasswordForm apiUrl="http://api" />);
    expect(html).toContain(fr.auth.reset.title);
    expect(html).toContain(`minLength="${limits.PASSWORD_MIN_LENGTH}"`);
  });
});

describe("organizer's tournaments", () => {
  it("lists them, or says there are none yet", () => {
    expect(render(<TournamentList tournaments={[]} />)).toContain(fr.organizer.noTournament);
    const html = render(<TournamentList tournaments={[{ id: "t1", name: "Tournoi de Noël" }]} />);
    expect(html).toContain("Tournoi de Noël");
    expect(html).not.toContain(fr.organizer.noTournament);
  });
});
