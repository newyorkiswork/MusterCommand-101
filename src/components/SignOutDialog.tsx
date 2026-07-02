import React from "react";
import { LogOut, AlertCircle, Clock } from "lucide-react";
import { AuthUser } from "../auth";

interface SignOutDialogProps {
  currentUser: AuthUser;
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function SignOutDialog({
  currentUser,
  isOpen,
  onConfirm,
  onCancel,
}: SignOutDialogProps) {
  if (!isOpen) return null;

  const sessionDuration = Math.floor((Date.now() - currentUser.loginTime) / 1000);
  const minutes = Math.floor(sessionDuration / 60);
  const seconds = sessionDuration % 60;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4">
          <h3 className="text-lg font-black text-white tracking-wide flex items-center gap-2">
            <LogOut size={20} />
            Sign Out
          </h3>
          <p className="text-sm text-orange-100 mt-1">
            End your session and return to login
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Session info */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-sm font-black text-blue-700">
                  {currentUser.role.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                  Current Session
                </p>
                <p className="text-sm font-mono font-bold text-slate-900 mt-0.5">
                  {currentUser.badgeId}
                </p>
                <p className="text-xs text-slate-600 mt-0.5">
                  Role: <span className="font-bold">{currentUser.role}</span>
                </p>
              </div>
            </div>

            {/* Session duration */}
            <div className="flex items-center gap-2 pt-3 border-t border-slate-200">
              <Clock size={14} className="text-slate-600" />
              <span className="text-xs text-slate-600">
                Session active:{" "}
                <span className="font-bold">
                  {minutes}m {seconds}s
                </span>
              </span>
            </div>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-300 rounded-xl p-3">
            <AlertCircle size={16} className="text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700">
              All unsaved incident data will be persisted to the ledger. Your
              session token will be revoked immediately.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-sm hover:bg-slate-100 transition-all cursor-pointer active:scale-95"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-all cursor-pointer active:scale-95 shadow-md hover:shadow-lg"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
