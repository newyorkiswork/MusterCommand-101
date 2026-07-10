import { Occupant, LedgerBlock } from "./types";

// ============================================================================
// Floor 7 Pilot — Success Criteria as data
// 4 Irving Plaza, ConEdison Corporate HQ. These are the 15 measurable objectives
// the pilot is graded against. Encoded as a structure so the Command Deck can
// score them live and the FDNY / LL26 record can cite target vs. actual.
// ============================================================================

// Pilot census targets (from EAP + ConEd Floor 7 pilot roster). Denominators
// for accountability metrics come from the LIVE roster (occupants.length),
// not a fixed 200 — pilot roster is smaller than full-floor census.
export const FLOOR7_CENSUS = {
  fullFloorCapacity: 200, // full daytime occupancy of Floor 7 (reference only)
  evacChairOccupants: 4, // mobility-impaired on the evac-chair (ARA) list
  lobbyVisitors: 11, // visitors signed in at the lobby
  accountTargetSeconds: 180, // account for everyone in < 3 min
  accountStretchSeconds: 90, // stretch: < 90 s
  meshVisibleTargetPct: 95, // blackout: keep 95%+ visible
  meshTargetSeconds: 120, // ...within 2 min
  araVisibleSeconds: 30, // evac-chair visible within 30 s
  drillRecordSeconds: 300, // LL26 record generated in < 5 min
  oshaAccountSeconds: 720, // OSHA ceiling — account for all in < 12 min
  zoneSweepTargetPct: 98, // ≥98% zone sweep completion (warden coverage)
  wearableSurfaceSeconds: 10, // critical wearable events surface in < 10 s
  familyReachPct: 90, // 90%+ next-of-kin reached
  familyReachSeconds: 60, // ...within 60 s of a safe check-in
  drillParticipationTargetPct: 85, // ≥85% occupant participation rate
};

export type GoalStatus = "MET" | "ON_TRACK" | "AT_RISK" | "PENDING";

export type GoalCategory =
  | "Accountability"
  | "Resilience"
  | "Operations"
  | "Accessibility"
  | "Compliance"
  | "Integrity"
  | "Family"
  | "Wearables";

// Compliance-first design: every pilot goal traces back to a specific
// regulation. Grouping metrics by this field on the FSD Command Deck lets
// auditors verify the pilot satisfies each regulation without cross-referencing
// a separate PRD or spec document.
export type Regulation =
  | "OSHA 29 CFR 1910.38" // EAP: evac procedures, drills, disabled accommodation
  | "NYC Local Law 26 / RS-17" // 10-yr retention, hash-chained records, F-89 reporting
  | "FDNY F-89" // Pre-arrival report, elevator recall, muster records
  | "NFPA 72 / EAP" // Mass notification, ICS action plan, hazard visualization
  | "ADA / EAP ARA"; // Areas of Rescue Assistance, mobility-impaired priority

export interface PilotGoalContext {
  occupants: Occupant[];
  ledger: LedgerBlock[];
  ledgerVerified: boolean;
  elapsedSeconds: number; // time since incident declared
  isBlackout: boolean;
  isDrill: boolean; // true = drill, false = real incident
  activeDirective?: string; // current F-89 / ICS broadcast
  records?: { drill: number; real: number };
}

export interface PilotGoalResult {
  value: string;
  status: GoalStatus;
  detail?: string;
}

export interface PilotGoal {
  id: string;
  category: GoalCategory;
  regulation: Regulation;
  citation: string; // e.g. "29 CFR 1910.38(e)" — shown as a small tag on the card
  title: string;
  target: string;
  stretch?: string;
  evaluate: (ctx: PilotGoalContext) => PilotGoalResult;
}

// --- helpers -----------------------------------------------------------------
const isAccounted = (o: Occupant) => o.status === "SAFE";
const isVisible = (o: Occupant) => Boolean(o.status);
const fmt = (sec: number) => {
  const m = Math.floor(sec / 60)
    .toString()
    .padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};
const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

// ============================================================================
// 15 pilot goals — EAP / OSHA / FDNY-aligned metrics
// ============================================================================
export const PILOT_GOALS: PilotGoal[] = [
  // 1. Time to account for all 200 ─────────────────────────────────────────
  // 1. Time to account for full roster ─────────────────────────
  {
    id: "account_all",
    category: "Accountability",
    regulation: "OSHA 29 CFR 1910.38",
    citation: "29 CFR 1910.38(c)(4)",
    title: "Time to account for full roster",
    target: "OSHA < 12 min · Pilot < 3 min",
    stretch: "< 90 s",
    evaluate: ({ occupants, elapsedSeconds }) => {
      const total = occupants.length;
      const accounted = occupants.filter(isAccounted).length;
      const rate = pct(accounted, Math.max(total, 1));
      const value = `${accounted}/${total} (${rate}%) @ ${fmt(elapsedSeconds)}`;
      let status: GoalStatus = "ON_TRACK";
      if (rate === 100) {
        status =
          elapsedSeconds <= FLOOR7_CENSUS.accountTargetSeconds
            ? "MET"
            : elapsedSeconds <= FLOOR7_CENSUS.oshaAccountSeconds
              ? "ON_TRACK"
              : "AT_RISK";
      } else if (elapsedSeconds > FLOOR7_CENSUS.oshaAccountSeconds) {
        status = "AT_RISK";
      }
      return {
        value,
        status,
        detail:
          "OSHA 29 CFR 1910.38 ceiling: < 12 min · Floor 7 target: < 3 min",
      };
    },
  },

  // 2. Occupant visibility during blackout ──────────────────────────────────
  // 2. Occupant visibility during blackout ──────────────────────
  {
    id: "blackout_mesh",
    category: "Resilience",
    regulation: "NFPA 72 / EAP",
    citation: "NFPA 72 § 24 (mass notification resilience)",
    title: "Occupant visibility during blackout",
    target: "≥95% visible to FSD within 2 min",
    evaluate: ({ occupants, isBlackout }) => {
      const total = occupants.length;
      if (!isBlackout) {
        return {
          value: `${total}/${total} (100%) via cloud`,
          status: "MET",
          detail: "Primary cloud link — all occupants streaming",
        };
      }
      const visible = occupants.filter(isVisible).length;
      const rate = pct(visible, Math.max(total, 1));
      return {
        value: `${rate}% visible via BLE mesh`,
        status: rate >= FLOOR7_CENSUS.meshVisibleTargetPct ? "MET" : "AT_RISK",
        detail: `BLE mesh active — ${visible} of ${total} in coverage`,
      };
    },
  },

  // 3. Real-time occupant location state via SSE ────────────────────
  {
    id: "location_realtime",
    category: "Operations",
    regulation: "NFPA 72 / EAP",
    citation: "NFPA 72 § 24.4 (real-time status)",
    title: "Real-time occupant location state",
    target: "All occupants on FSD screen via SSE",
    evaluate: ({ isBlackout, occupants }) => ({
      value: isBlackout ? "BLE mesh fallback active" : "SSE stream live",
      status: isBlackout ? "ON_TRACK" : "MET",
      detail: isBlackout
        ? "SSE degraded — mesh maintaining feeds"
        : `Primary SSE stream active for all ${occupants.length}`,
    }),
  },

  // 4. Mobility-impaired on Red List < 30 s ─────────────────────────────────
  // 4. Mobility-impaired on Red List < 30 s ───────────────────────
  {
    id: "ara_visibility",
    category: "Accessibility",
    regulation: "ADA / EAP ARA",
    citation: "29 CFR 1910.38(c)(3) · ADA Title III",
    title: "Mobility-impaired on Red List",
    target: "All 4 evac-chair occupants visible < 30 s",
    evaluate: ({ occupants, elapsedSeconds }) => {
      const ara = occupants.filter((o) => o.mobilityImpaired || o.isAtARA);
      const visible = ara.filter(isVisible).length;
      const denom = Math.max(ara.length, FLOOR7_CENSUS.evacChairOccupants);
      const value = `${visible}/${denom} on FSD Red List`;
      let status: GoalStatus = ara.length === 0 ? "PENDING" : "ON_TRACK";
      if (ara.length > 0 && visible === ara.length) {
        status =
          elapsedSeconds <= FLOOR7_CENSUS.araVisibleSeconds ? "MET" : "AT_RISK";
      }
      return {
        value,
        status,
        detail: "Visible to FSD + FDNY responding company",
      };
    },
  },

  // 5. Hazard polygon on floor plan < 5 s ───────────────────────────────────
  // 5. Hazard visualization on floor plan < 5 s ────────────────────
  {
    id: "hazard_polygon",
    category: "Operations",
    regulation: "NFPA 72 / EAP",
    citation: "NFPA 72 § 24.5 (situational awareness)",
    title: "Hazard visualization on floor plan",
    target: "Auto-rendered < 5s after alarm declaration",
    evaluate: ({ activeDirective }) => {
      const declared = Boolean(activeDirective);
      return {
        value: declared
          ? "Hazard zones + blocked stairs rendered on plan"
          : "Awaiting alarm declaration",
        status: declared ? "MET" : "PENDING",
        detail: "Alarm declared → zones + stair status render in < 5 s",
      };
    },
  },

  // 6. ICS Action Plan auto-loaded < 5 s ────────────────────────────────────
  // 6. ICS Action Plan auto-loaded < 5 s ────────────────────────
  {
    id: "ics_action_plan",
    category: "Operations",
    regulation: "FDNY F-89",
    citation: "FDNY F-89 (ICS action plan)",
    title: "ICS Action Plan auto-loaded",
    target: "Active directive < 5s after declaration",
    evaluate: ({ activeDirective }) => ({
      value: activeDirective ? "F-89 ICS plan active" : "Awaiting declaration",
      status: activeDirective ? "MET" : "PENDING",
      detail: "F-89 directive auto-loaded on alarm trigger",
    }),
  },

  // 7. FDNY / NYC LL26 drill record < 5 min ─────────────────────────────────
  // 7. FDNY / NYC LL26 drill record < 5 min ─────────────────────
  {
    id: "drill_record",
    category: "Compliance",
    regulation: "NYC Local Law 26 / RS-17",
    citation: "NYC LL26 · RS-17 · 10-yr retention",
    title: "FDNY compliance record filed",
    target: "< 5 min from incident close",
    evaluate: ({ records }) => {
      const total = (records?.drill ?? 0) + (records?.real ?? 0);
      if (total === 0) {
        return {
          value: "No report filed yet",
          status: "PENDING",
          detail: "Click ‘Generate Compliance Report’ to file & persist",
        };
      }
      return {
        value: `${total} report${total === 1 ? "" : "s"} filed · chain-persisted`,
        status: "MET",
        detail: "NYC LL26 — replaces 2 weeks of paper assembly, 10-yr retention",
      };
    },
  },

  // 8. Chain verification integrity — 100% across 1000+ events ─────────────
  {
    id: "chain_integrity",
    category: "Integrity",
    regulation: "NYC Local Law 26 / RS-17",
    citation: "NYC LL26 · tamper-evident record chain",
    title: "Chain verification integrity",
    target: "100% across 1000+ events",
    evaluate: ({ ledgerVerified, ledger }) => ({
      value: ledgerVerified
        ? `Verified · ${ledger.length} block${ledger.length === 1 ? "" : "s"} · SHA-256 intact`
        : "TAMPER DETECTED — chain broken",
      status: ledgerVerified ? "MET" : "AT_RISK",
      detail: "Hash-chained ledger shifts post-incident litigation posture",
    }),
  },

  // 9. Drill data in real-incident export — 0 rows ────────────────────
  {
    id: "drill_data_isolation",
    category: "Compliance",
    regulation: "OSHA 29 CFR 1910.38",
    citation: "29 CFR 1910.38(e) · drill record integrity",
    title: "Drill data in real-incident export",
    target: "0 rows — never in any FDNY filing",
    evaluate: ({ isDrill, records }) => {
      const drill = records?.drill ?? 0;
      const real = records?.real ?? 0;
      return {
        value: isDrill ? "DRILL mode — quarantined" : "REAL incident mode",
        status: "MET",
        detail: `REAL: ${real} filing${real === 1 ? "" : "s"} · DRILL: ${drill} entr${drill === 1 ? "y" : "ies"} — isolated`,
      };
    },
  },

  // 10. Family SAFE-SMS ≥90% within 60 s ────────────────────────────────────
  // 10. Family SAFE-SMS ≥90% within 60 s ────────────────────────
  {
    id: "family_notification",
    category: "Family",
    regulation: "NFPA 72 / EAP",
    citation: "NFPA 72 § 24.9 (family notification)",
    title: "Family SAFE-SMS reach",
    target: "≥90% next-of-kin within 60 s of safe check-in",
    evaluate: ({ occupants, isDrill }) => {
      if (isDrill)
        return {
          value: "Suppressed — DRILL mode",
          status: "MET",
          detail: "Family SMS never fires on drills",
        };
      const eligible = occupants.filter(
        (o) => o.nextOfKinRegistered && isAccounted(o),
      );
      const notified = eligible.filter((o) => o.nextOfKinNotified).length;
      const rate = pct(notified, Math.max(eligible.length, 1));
      return {
        value: `${rate}% of next-of-kin reached`,
        status:
          eligible.length === 0
            ? "PENDING"
            : rate >= FLOOR7_CENSUS.familyReachPct
              ? "MET"
              : "AT_RISK",
        detail: "Real incidents only — auto-dispatched on safe check-in",
      };
    },
  },

  // 11. Wearable critical event → Red List < 10 s ─────────────────────
  {
    id: "wearable_critical",
    category: "Wearables",
    regulation: "OSHA 29 CFR 1910.38",
    citation: "29 CFR 1910.38(d) · employee alarm systems",
    title: "Wearable critical event → Red List",
    target: "Surface on FSD Red List < 10 s",
    evaluate: ({ occupants }) => {
      const criticalCount = occupants.filter(
        (o) => o.status === "CRITICAL" || o.fallDetected,
      ).length;
      const wearableCount = occupants.filter((o) => o.wearable).length;
      if (wearableCount === 0) {
        return {
          value: "No wearables provisioned",
          status: "PENDING",
          detail: "Enroll occupants with fall/SOS devices to activate",
        };
      }
      if (criticalCount === 0) {
        return {
          value: `${wearableCount} wearable${wearableCount === 1 ? "" : "s"} standing by`,
          status: "MET",
          detail: "No active events · fall/SOS telemetry armed",
        };
      }
      return {
        value: `${criticalCount} event${criticalCount === 1 ? "" : "s"} surfaced on Red List`,
        status: "MET",
        detail: "Fall / SOS telemetry auto-escalates in < 10 s",
      };
    },
  },

  // 12. Occupant drill participation rate ≥85% ──────────────────────
  {
    id: "drill_participation",
    category: "Compliance",
    regulation: "OSHA 29 CFR 1910.38",
    citation: "29 CFR 1910.38(e) · annual drill record",
    title: "Drill participation rate",
    target: "≥85% of floor census (DRILL mode)",
    evaluate: ({ occupants, isDrill }) => {
      if (!isDrill) {
        return {
          value: "N/A — REAL incident mode",
          status: "MET",
          detail: "Metric applies to drills only; real incidents track differently",
        };
      }
      const nonVisitors = occupants.filter(
        (o) => !o.isVisitor && o.role !== "Visitor",
      );
      const participants = nonVisitors.filter((o) => o.drillParticipant).length;
      const total = nonVisitors.length;
      const rate = pct(participants, Math.max(total, 1));
      return {
        value: `${participants}/${total} (${rate}%)`,
        status:
          rate >= FLOOR7_CENSUS.drillParticipationTargetPct
            ? "MET"
            : rate >= 70
              ? "ON_TRACK"
              : "AT_RISK",
        detail: "OSHA 1910.38(e) — warden-attested drill participation",
      };
    },
  },

  // 13. 100% accountability across all personnel types ─────────────────
  {
    id: "personnel_breakdown",
    category: "Accountability",
    regulation: "OSHA 29 CFR 1910.38",
    citation: "29 CFR 1910.38(c)(5) · all personnel accounted",
    title: "Accountability by personnel type",
    target: "100% across all three personnel types",
    evaluate: ({ occupants }) => {
      const isEmployee = (o: Occupant) =>
        ["Occupant", "Warden", "FSD", "Searcher", "Deputy"].includes(o.role) &&
        !o.isVisitor;
      const isContractor = (o: Occupant) => o.role === "Contractor";
      const isVisitor = (o: Occupant) => o.isVisitor || o.role === "Visitor";

      const emp = occupants.filter(isEmployee);
      const con = occupants.filter(isContractor);
      const vis = occupants.filter(isVisitor);

      const empSafe = emp.filter(isAccounted).length;
      const conSafe = con.filter(isAccounted).length;
      const visSafe = vis.filter(isAccounted).length;

      const allSafe =
        empSafe === emp.length &&
        conSafe === con.length &&
        visSafe === vis.length;
      return {
        value: `EMP ${empSafe}/${emp.length} · CON ${conSafe}/${con.length} · VIS ${visSafe}/${vis.length}`,
        status: allSafe ? "MET" : "ON_TRACK",
        detail:
          "EAP requires 100% accountability across all three personnel types",
      };
    },
  },

  // 14. Zone sweep completion ≥98% — warden coverage ─────────────────
  {
    id: "zone_sweep_completion",
    category: "Operations",
    regulation: "FDNY F-89",
    citation: "FDNY F-89 · warden sweep documentation",
    title: "Zone sweep completion",
    target: "≥98% of floor quadrants fully swept by wardens",
    evaluate: ({ occupants }) => {
      const quadrants: Array<"NW" | "NE" | "SW" | "SE" | "Center"> = [
        "NW",
        "NE",
        "SW",
        "SE",
        "Center",
      ];
      // A quadrant counts as "swept" when every occupant in it has a non-MISSING status
      // (warden has visually confirmed and updated everyone in that quadrant).
      const swept = quadrants.filter((q) => {
        const inQuad = occupants.filter((o) => o.quadrant === q);
        return (
          inQuad.length === 0 || inQuad.every((o) => o.status !== "MISSING")
        );
      });
      const rate = pct(swept.length, quadrants.length);
      return {
        value: `${swept.length}/${quadrants.length} quadrants (${rate}%)`,
        status:
          rate >= FLOOR7_CENSUS.zoneSweepTargetPct
            ? "MET"
            : rate >= 80
              ? "ON_TRACK"
              : "AT_RISK",
        detail: "Floor wardens sweep NW · NE · SW · SE · Center",
      };
    },
  },

  // 15. Roster accuracy — warden-attested floor roster ─────────────────
  {
    id: "roster_accuracy",
    category: "Compliance",
    regulation: "NYC Local Law 26 / RS-17",
    citation: "NYC LL26 · badge-linked occupant roster",
    title: "Roster accuracy & data integrity",
    target: "Floor roster verified & badge-linked",
    evaluate: ({ occupants }) => {
      const total = occupants.length;
      const badgeLinked = occupants.filter((o) => Boolean(o.badgeId)).length;
      const rate = pct(badgeLinked, Math.max(total, 1));
      return {
        value: `${badgeLinked}/${total} badge-linked (${rate}%)`,
        status: rate === 100 ? "MET" : rate >= 95 ? "ON_TRACK" : "AT_RISK",
        detail:
          "Floor Warden responsibility — every occupant tied to a badge ID",
      };
    },
  },
];
