// ConEd Life-Safety Auth System
// Tokenization, Role-Based Access Control, Biometric Fallback

import { Occupant } from "./types";

export interface AuthUser {
  id: string;
  badgeId: string;
  nameEncrypted: string;
  role: string;
  loginMethod: "password" | "biometric";
  loginTime: number;
  sessionToken: string;
}

export interface AuthError {
  code: "INVALID_BADGE" | "INVALID_PASSWORD" | "BIOMETRIC_FAILED" | "SESSION_EXPIRED";
  message: string;
}

// Simulated FSD/Warden credentials. In production, this would query
// a real LDAP/AD system or ConEd's identity vault. Here we use the occupant
// roster's badgeId + a fixed demo password.
export const DEMO_CREDENTIALS: Record<
  string,
  { badgeId: string; role: string; password: string }
> = {
  FSD001: {
    badgeId: "FSD001",
    role: "FSD",
    password: "ConEd@2026", // Demo only; in prod use salted bcrypt
  },
  WRD002: {
    badgeId: "WRD002",
    role: "Warden",
    password: "ConEd@2026",
  },
  OPS003: {
    badgeId: "OPS003",
    role: "Occupant",
    password: "ConEd@2026",
  },
};

// Generate a simple session token (in prod: use JWT/OAuth2)
export function generateSessionToken(): string {
  return `sess_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`;
}

/**
 * Authenticate via badge ID + password
 */
export function authenticatePassword(
  badgeId: string,
  password: string
): AuthUser | AuthError {
  const cred = DEMO_CREDENTIALS[badgeId];
  if (!cred) {
    return {
      code: "INVALID_BADGE",
      message: `Badge ${badgeId} not found in system.`,
    };
  }
  if (cred.password !== password) {
    return {
      code: "INVALID_PASSWORD",
      message: "Password incorrect.",
    };
  }
  return {
    id: `usr_${badgeId}_${Date.now()}`,
    badgeId: cred.badgeId,
    nameEncrypted: "●●●●●●●●●●●●●●", // Tokenized at rest
    role: cred.role,
    loginMethod: "password",
    loginTime: Date.now(),
    sessionToken: generateSessionToken(),
  };
}

/**
 * Simulate biometric (WebAuthn) authentication.
 * In production, this uses navigator.credentials.get() with PublicKeyCredential.
 * Here we simulate success if the device supports sensors.
 */
export async function authenticateBiometric(
  badgeId: string
): Promise<AuthUser | AuthError> {
  // Check if browser supports WebAuthn
  if (!window.PublicKeyCredential) {
    return {
      code: "BIOMETRIC_FAILED",
      message:
        "Biometric auth not supported. Use badge + password instead.",
    };
  }

  const cred = DEMO_CREDENTIALS[badgeId];
  if (!cred) {
    return {
      code: "INVALID_BADGE",
      message: `Badge ${badgeId} not found in system.`,
    };
  }

  // Simulate a 1-second biometric scan delay
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // In production, use navigator.credentials.get() and verify against
  // a credential public key stored on the server.
  // For now, we simulate success (demo only).
  return {
    id: `usr_${badgeId}_biometric_${Date.now()}`,
    badgeId: cred.badgeId,
    nameEncrypted: "●●●●●●●●●●●●●●",
    role: cred.role,
    loginMethod: "biometric",
    loginTime: Date.now(),
    sessionToken: generateSessionToken(),
  };
}

/**
 * Check if the device has biometric capability (fingerprint, face, etc.)
 */
export async function hasBiometricCapability(): Promise<boolean> {
  if (!window.PublicKeyCredential) return false;
  try {
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return available;
  } catch {
    return false;
  }
}

/**
 * Validate session token (in prod: JWT signature verification)
 */
export function validateSessionToken(token: string): boolean {
  return token.startsWith("sess_") && token.length > 20;
}
