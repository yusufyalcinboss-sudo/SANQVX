import {timingSafeEqual} from "node:crypto";
import {COOKIE_NAME, SESSION_SECONDS, createSessionToken, hasValidSession} from "../lib/access-session.js";

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, private");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const secret = process.env.SANQVX_ACCESS_KEY;
  if (!secret) return res.status(503).json({error: "Access key verification is not configured."});

  if (req.method === "GET") {
    if (hasValidSession(req.headers.cookie, secret)) return res.status(200).json({authenticated: true});
    return res.status(401).json({authenticated: false});
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({error: "Method not allowed."});
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({error: "Invalid JSON request body."});
    }
  }
  const candidate = body && typeof body.key === "string" ? body.key : "";
  const expected = Buffer.from(secret);
  const received = Buffer.from(candidate);
  const matches = expected.length === received.length && timingSafeEqual(expected, received);
  if (!matches) return res.status(401).json({authenticated: false});

  const secure = process.env.VERCEL || req.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=${createSessionToken(secret)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_SECONDS}${secure}`);
  return res.status(200).json({authenticated: true});
}
