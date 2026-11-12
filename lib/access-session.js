import {createHmac, timingSafeEqual} from "node:crypto";

export const COOKIE_NAME = "sanqvx_access_v2";
export const SESSION_SECONDS = 7 * 24 * 60 * 60;

function sign(expiry, secret) {
  return createHmac("sha256", secret).update(expiry).digest("base64url");
}

export function createSessionToken(secret, now = Date.now()) {
  const expiry = String(Math.floor(now / 1000) + SESSION_SECONDS);
  return `${expiry}.${sign(expiry, secret)}`;
}

export function hasValidSession(cookieHeader, secret, now = Date.now()) {
  const prefix = `${COOKIE_NAME}=`;
  const cookie = (cookieHeader || "").split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix));
  if (!cookie) return false;

  const token = cookie.slice(prefix.length);
  const separator = token.indexOf(".");
  if (separator < 1) return false;

  const expiry = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!/^\d+$/.test(expiry) || Number(expiry) <= Math.floor(now / 1000)) return false;

  const expected = Buffer.from(sign(expiry, secret));
  const received = Buffer.from(signature);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
