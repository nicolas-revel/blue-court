import { getRequestConfig } from "next-intl/server";

// The UI is in French only for now; other languages add a messages file and a locale choice.
export const locale = "fr";

export default getRequestConfig(async () => ({
  locale,
  messages: (await import(`../../messages/${locale}.json`)).default,
}));
