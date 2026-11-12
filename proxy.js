import {next} from "@vercel/functions";
import {hasValidSession} from "./lib/access-session.js";

export default function proxy(request) {
  const url = new URL(request.url);
  if (url.pathname === "/login.html" || url.pathname === "/sw.js" || url.pathname === "/api/verify-key") {
    return next();
  }

  const secret = process.env.SANQVX_ACCESS_KEY;
  if (!secret) {
    return new Response("Access key verification is not configured.", {
      status: 503,
      headers: {"Cache-Control": "no-store"},
    });
  }

  if (hasValidSession(request.headers.get("cookie"), secret)) return next();

  if (url.pathname.startsWith("/api/")) {
    return Response.json({error: "Authentication required."}, {
      status: 401,
      headers: {"Cache-Control": "no-store"},
    });
  }

  return Response.redirect(new URL("/login.html", request.url), 302);
}
