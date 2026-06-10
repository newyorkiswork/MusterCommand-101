import { LedgerBlock } from "./types";

/**
 * Computes the official SHA-256 hash of a string using the native Web Crypto API.
 * Ensures data ledger security and mathematical chain verification.
 */
export async function clientSHA256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Creates and chains a new block onto the ledger securely.
 */
export async function createNextBlock(
  prevBlock: LedgerBlock,
  index: number,
  event: string
): Promise<LedgerBlock> {
  const timestamp = new Date().toISOString();
  const content = index + timestamp + event + prevBlock.hash;
  const hash = await clientSHA256(content);
  return {
    index,
    timestamp,
    event,
    prevHash: prevBlock.hash,
    hash
  };
}

/**
 * XSS & HTML Script Sanitization Routine (Acts as a focused DOMPurify alternative)
 * Strips script tags, HTML tags, and harmful entities from occupant logs.
 */
export function sanitizeText(text: string): string {
  if (!text) return "";
  return text
    .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, "")
    .replace(/<[^>]*>?/gm, "")
    .replace(/[\\\/\"\'\`\<\>\{\}]/g, "")
    .trim();
}

/**
 * Validates Badge ID according to strict rules (e.g., NW449210 -> Two capital letters followed by six digits)
 * Schema complies with Layer 1 validation in Section 5.
 */
export function validateBadgeSyntax(badge: string): boolean {
  const badgeRegex = /^[A-Z]{2}\d{6}$/;
  return badgeRegex.test(badge.toUpperCase().trim());
}
