
import "server-only";

export type AdminCookieConfig = {
  name: "admin_session" | "__Host-admin_session";
  secure: boolean;
};

export function getAdminCookieConfig(): AdminCookieConfig {
  const originRaw = process.env.ADMIN_APP_ORIGIN;

  if (!originRaw) {
    throw new Error("ADMIN_APP_ORIGIN is required.");
  }

  const origin = new URL(originRaw);

  if (
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash ||
    origin.username ||
    origin.password
  ) {
    throw new Error("Invalid ADMIN_APP_ORIGIN.");
  }

  const localhost =
    origin.hostname === "localhost" ||
    origin.hostname === "127.0.0.1";

  const https = origin.protocol === "https:";

  if (!https && !localhost) {
    throw new Error(
      "Admin authentication requires HTTPS outside localhost.",
    );
  }

  const nameRaw = process.env.ADMIN_SESSION_COOKIE_NAME;
  const secureRaw = process.env.ADMIN_SESSION_COOKIE_SECURE;

  const name =
    nameRaw ??
    (https ? "__Host-admin_session" : "admin_session");

  const secure =
    secureRaw === undefined
      ? https
      : secureRaw === "true"
        ? true
        : secureRaw === "false"
          ? false
          : (() => {
              throw new Error(
                "ADMIN_SESSION_COOKIE_SECURE must be true or false.",
              );
            })();

  if (
    name !== "admin_session" &&
    name !== "__Host-admin_session"
  ) {
    throw new Error("Invalid ADMIN_SESSION_COOKIE_NAME.");
  }

  if (!localhost && (!https || !secure)) {
    throw new Error(
      "Secure HTTPS cookies are required outside localhost.",
    );
  }

  if (name === "__Host-admin_session" && !secure) {
    throw new Error(
      "__Host-admin_session requires Secure=true.",
    );
  }

  if (https && name !== "__Host-admin_session") {
    throw new Error(
      "HTTPS production requires __Host-admin_session.",
    );
  }

  return { name, secure };
}
