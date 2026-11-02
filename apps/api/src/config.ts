/** The web app's address, the only origin allowed to call the API and its socket. */
export const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";

/** Session cookies are sent over HTTPS only once the web app is served over HTTPS. */
export const secureCookies = webOrigin.startsWith("https://");
