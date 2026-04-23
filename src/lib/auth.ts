import "server-only";

import { createHmac, randomUUID, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

const COOKIE_NAME = "bazin_session";
const SESSION_DAYS = 60;

export type Session = {
  id: number;
  nume: string;
};

function getSecret() {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "dev-secret-change-me";
}

function base64Url(input: string | Buffer) {
  return Buffer.from(input).toString("base64url");
}

function sign(payload: string) {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

function createToken(session: Session) {
  const payload = base64Url(
    JSON.stringify({
      ...session,
      exp: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000,
    }),
  );

  return `${payload}.${sign(payload)}`;
}

function verifyToken(token: string): Session | null {
  const [payload, signature] = token.split(".");

  if (!payload || !signature || sign(payload) !== signature) {
    return null;
  }

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as
      | (Session & { exp: number })
      | null;

    if (!data?.id || !data.nume || data.exp < Date.now()) {
      return null;
    }

    return { id: data.id, nume: data.nume };
  } catch {
    return null;
  }
}

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function hashPassword(password: string) {
  const salt = randomUUID();
  const key = scryptSync(password, salt, 64).toString("hex");

  return `scrypt:${salt}:${key}`;
}

export function verifyPassword(password: string, storedHash: string) {
  if (storedHash.startsWith("scrypt:")) {
    const [, salt, key] = storedHash.split(":");

    if (!salt || !key) {
      return false;
    }

    return safeCompare(scryptSync(password, salt, 64).toString("hex"), key);
  }

  return safeCompare(password, storedHash);
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  return token ? verifyToken(token) : null;
}

export async function requireSession() {
  const session = await getSession();

  if (!session) {
    throw new Error("Trebuie sa fii autentificat.");
  }

  return session;
}

export async function login(nume: string, password: string) {
  const antrenor = await prisma.antrenor.findUnique({
    where: { nume },
  });

  if (!antrenor || !verifyPassword(password, antrenor.passwordHash)) {
    return false;
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, createToken({ id: antrenor.id, nume: antrenor.nume }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });

  return true;
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
