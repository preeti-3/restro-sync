import "server-only";

export function getAppUrl() {
  const configured = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  const fallback = process.env.NODE_ENV === "development" ? "http://localhost:3000" : null;
  const value = configured?.trim() || fallback;

  if (!value) {
    throw new Error("APP_URL must be configured with the public HTTPS application URL.");
  }

  const url = new URL(value);
  if (process.env.NODE_ENV === "production" && (url.hostname === "localhost" || url.hostname === "127.0.0.1")) {
    throw new Error("APP_URL cannot point to localhost in production.");
  }

  return url.origin;
}
