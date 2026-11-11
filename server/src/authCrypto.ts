import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function hashSecret(secret: string, salt = randomBytes(16).toString("hex")): {
  hash: string;
  salt: string;
} {
  const hash = scryptSync(secret, salt, 32).toString("hex");
  return { hash, salt };
}

export function verifySecret(secret: string, hash: string, salt: string): boolean {
  const next = scryptSync(secret, salt, 32);
  const prev = Buffer.from(hash, "hex");
  if (prev.length !== next.length) {
    return false;
  }
  return timingSafeEqual(prev, next);
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}
