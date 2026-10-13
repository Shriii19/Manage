import type { Request, RequestHandler } from "express";
import { createRemoteJWKSet, errors as joseErrors, jwtVerify } from "jose";
import { env } from "../env.js";
import { HttpError } from "./errors.js";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const jwks = createRemoteJWKSet(new URL(`${env.NEON_AUTH_URL}/.well-known/jwks.json`));
// Neon Auth issues tokens with iss/aud set to the origin of the auth URL, not the full path.
const issuer = new URL(env.NEON_AUTH_URL).origin;

export const requireAuth: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new HttpError(401, "Missing bearer token");
  }

  try {
    const { payload } = await jwtVerify(header.slice("Bearer ".length), jwks, {
      issuer,
      audience: issuer,
    });

    if (typeof payload.sub !== "string") {
      throw new HttpError(401, "Token has no subject");
    }

    req.user = {
      id: payload.sub,
      email: typeof payload.email === "string" ? payload.email : "",
      name: typeof payload.name === "string" ? payload.name : "",
    };
  } catch (err) {
    if (err instanceof HttpError) throw err;
    if (err instanceof joseErrors.JWTExpired) throw new HttpError(401, "Token expired");
    // Network failures fetching the JWKS (DNS, timeout) aren't the client's fault; report them as 503.
    if (err instanceof joseErrors.JWKSTimeout || (err instanceof TypeError && err.message === "fetch failed")) {
      console.error("Could not fetch Neon Auth JWKS:", err.cause ?? err);
      throw new HttpError(503, "Auth service unreachable, please retry");
    }
    if (err instanceof joseErrors.JOSEError) throw new HttpError(401, "Invalid token");
    throw err;
  }

  next();
};

export function currentUser(req: Request): AuthUser {
  if (!req.user) {
    throw new HttpError(401, "Not authenticated");
  }
  return req.user;
}
