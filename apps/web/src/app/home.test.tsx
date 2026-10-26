import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import fr from "../../messages/fr.json";
import { Home } from "./home";
import manifest from "./manifest";

describe("home page", () => {
  it("is in French, from the translations", () => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="fr" messages={fr}>
        <Home />
      </NextIntlClientProvider>,
    );
    expect(html).toContain(fr.home.tagline);
    expect(html).toContain(fr.home.start);
  });
});

describe("web app manifest", () => {
  it("has what browsers need to install the app", () => {
    const { name, start_url, display, icons = [] } = manifest();
    expect(name).toBe("Blue Court");
    expect(start_url).toBe("/");
    expect(display).toBe("standalone");
    expect(icons.map((icon) => icon.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
  });
});
