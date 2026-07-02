import React, { useState, useEffect } from "react";
import {
  Fingerprint,
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
  Loader2,
  Smartphone,
} from "lucide-react";
import {
  authenticatePassword,
  authenticateBiometric,
  hasBiometricCapability,
  AuthUser,
  AuthError,
} from "../auth";

interface AuthScreenProps {
  onAuthSuccess: (user: AuthUser) => void;
  onLogEvent: (event: string) => void;
}

export default function AuthScreen({
  onAuthSuccess,
  onLogEvent,
}: AuthScreenProps) {
  const [badgeId, setBadgeId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [isBiometricTrying, setIsBiometricTrying] = useState(false);

  useEffect(() => {
    hasBiometricCapability().then(setBiometricAvailable);
  }, []);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const result = authenticatePassword(badgeId, password);
      if ("code" in result) {
        setError(result);
        onLogEvent(`❌ Auth failed: ${result.message}`);
      } else {
        onLogEvent(
          `✅ Password auth succeeded for badge ${result.badgeId} (${result.role})`
        );
        onAuthSuccess(result);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    if (!badgeId.trim()) {
      setError({
        code: "INVALID_BADGE",
        message: "Enter your badge ID first.",
      });
      return;
    }

    setError(null);
    setIsBiometricTrying(true);

    try {
      onLogEvent(`🔒 Scanning fingerprint for badge ${badgeId}...`);
      const result = await authenticateBiometric(badgeId);
      if ("code" in result) {
        setError(result);
        onLogEvent(`❌ Biometric auth failed: ${result.message}`);
      } else {
        onLogEvent(
          `✅ Biometric auth succeeded for badge ${result.badgeId} (${result.role})`
        );
        onAuthSuccess(result);
      }
    } finally {
      setIsBiometricTrying(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 flex flex-col items-center justify-center p-4">
      {/* ConEd Branding */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
            <Smartphone className="text-white" size={22} />
          </div>
          <div className="text-left">
            <h1 className="text-3xl font-black text-white tracking-tight">
              MusterCommand
            </h1>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Life-Safety Accountability
            </p>
          </div>
        </div>
        <p className="text-sm text-slate-400 font-mono">
          ConEdison HQ · 4 Irving Place, NYC
        </p>
      </div>

      {/* Auth Card */}
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
            <h2 className="text-lg font-black text-white tracking-wide">
              Floor 7 Access
            </h2>
            <p className="text-sm text-blue-100 mt-1">
              Badge ID + Password or Biometric
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handlePasswordLogin} className="p-6 space-y-4">
            {/* Error message */}
            {error && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-300 rounded-xl p-3">
                <AlertCircle size={16} className="text-red-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-red-700">Error</p>
                  <p className="text-xs text-red-600 mt-0.5">{error.message}</p>
                </div>
              </div>
            )}

            {/* Badge ID field */}
            <div>
              <label
                htmlFor="badge-id"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2"
              >
                Badge ID
              </label>
              <input
                id="badge-id"
                type="text"
                placeholder="e.g., FSD001"
                value={badgeId}
                onChange={(e) => {
                  setBadgeId(e.target.value.toUpperCase());
                  setError(null);
                }}
                disabled={isLoading || isBiometricTrying}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono font-bold disabled:bg-slate-100"
              />
            </div>

            {/* Password field */}
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  disabled={isLoading || isBiometricTrying}
                  className="w-full px-4 py-3 pr-12 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={!password || isLoading || isBiometricTrying}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1.5 font-mono">
                Demo: BadgeID + &quot;ConEd@2026&quot;
              </p>
            </div>

            {/* Sign in button */}
            <button
              type="submit"
              disabled={!badgeId || !password || isLoading || isBiometricTrying}
              className={`w-full py-3 rounded-xl font-black uppercase tracking-wider text-sm flex items-center justify-center gap-2 transition-all active:scale-95 ${
                isLoading || isBiometricTrying
                  ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                  : badgeId && password
                    ? "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-md hover:shadow-lg"
                    : "bg-slate-200 text-slate-500 cursor-not-allowed"
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <LogIn size={16} />
                  Sign In
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="px-6 py-3 flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-500 font-bold">OR</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* Biometric button */}
          {biometricAvailable ? (
            <div className="p-6 pt-3 space-y-3">
              <button
                type="button"
                onClick={handleBiometricLogin}
                disabled={!badgeId || isLoading || isBiometricTrying}
                className={`w-full py-3 rounded-xl font-bold uppercase tracking-wider text-sm flex items-center justify-center gap-2 border-2 transition-all active:scale-95 ${
                  isBiometricTrying || isLoading
                    ? "border-emerald-300 bg-emerald-50 text-emerald-600 cursor-not-allowed opacity-70"
                    : badgeId
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 cursor-pointer"
                      : "border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed"
                }`}
              >
                {isBiometricTrying ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <Fingerprint size={16} />
                    Fingerprint / Face
                  </>
                )}
              </button>
              <p className="text-xs text-slate-600 text-center">
                ✓ Biometric sensor available on this device
              </p>
            </div>
          ) : (
            <div className="px-6 py-3 text-center">
              <p className="text-xs text-slate-500">
                Biometric unavailable on this device. Use badge + password above.
              </p>
            </div>
          )}

          {/* Footer help */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
            <p className="text-xs text-slate-600 text-center font-mono">
              🔐 Credentials encrypted over TLS 1.3
              <br />
              Sessions timeout after 8 hours of inactivity
            </p>
          </div>
        </div>

        {/* Quick links for testing */}
        <div className="mt-6 text-center">
          <p className="text-xs text-slate-500 mb-3">Demo accounts:</p>
          <div className="grid grid-cols-2 gap-2">
            {["FSD001", "WRD002", "OPS003"].map((badge) => (
              <button
                key={badge}
                type="button"
                onClick={() => setBadgeId(badge)}
                className="text-xs font-mono px-3 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700 transition-all cursor-pointer"
              >
                {badge}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
