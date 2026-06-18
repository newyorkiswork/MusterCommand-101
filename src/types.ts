// ============================================================================
// MusterCommand Type Definitions
// Regulatory Authority: NYC Local Law 26 (RS-17) / OSHA 29 CFR 1910.38
// Facility: ConEdison Floor 7, 4 Irving Plaza, New York NY
// ============================================================================

/**
 * Personnel classification under the FDNY Fire Safety Plan.
 * F-89: Certified Fire Safety Director (on-duty required during business hours)
 * F-58: Certified Floor Fire Warden (required per floor per LL26)
 * Occupant: Standard badged employee
 * Contractor: Third-party personnel (tracked separately per FDNY regulations)
 * Visitor: Lobby sign-in personnel (highest accountability risk)
 */
export type OccupantRole =
  | "F-89 FSD"
  | "F-58 Warden"
  | "Occupant"
  | "Contractor"
  | "Visitor";

/**
 * Evacuation accountability status codes aligned with FDNY terminology.
 * ACCOUNTED: Personnel confirmed at muster zone (scanned or attested)
 * MISSING: Personnel unaccounted for — actively being located
 * ARA_STAGING: Mobility-impaired individual staged at Area of Rescue Assistance
 *              awaiting FDNY-assisted evacuation (OSHA 1910.38(c)(1))
 * MEDICAL: Personnel reporting injury, fall detection, or distress
 */
export type OccupantStatus =
  | "ACCOUNTED"
  | "MISSING"
  | "ARA_STAGING"
  | "MEDICAL";

/**
 * ConEdison Floor 7 departmental quadrants.
 * Mapped to the architectural floor plan at 4 Irving Plaza.
 */
export type Quadrant = "NW" | "NE" | "SW" | "SE" | "Center";

/**
 * Egress routes per the building's Emergency Action Plan (4 Irving Plaza).
 * Stair A: primary egress at the Main Entrance (Irving Place)
 * Stair C: east stairwell (East 14th St) — secondary, can be blocked
 * ARA: Area of Rescue Assistance (mobility-impaired only)
 */
export type EgressRoute = "Stair A" | "Stair C" | "ARA";

/**
 * Muster assembly zones around Union Square.
 * Zone A: Union Square Park (primary, FDNY recommended)
 * Zone B: Irving Pl & 14th St (secondary south)
 * Zone C: Irving Pl & 15th St (tertiary north, closest to FDNY staging on E 15th)
 */
export type MusterZone = "Zone A" | "Zone B" | "Zone C";

export interface Occupant {
  id: string; // Vault Token (e.g. usr_a7f8c9d1)
  badgeId: string; // Physical badge code (e.g. FE019283)
  nameEncrypted: string; // Tokenization-at-Rest placeholder (e.g. "J••• D••")
  role: OccupantRole; // FDNY Fire Safety Plan designation
  status: OccupantStatus; // Current evacuation accountability state
  quadrant: Quadrant; // Last-known departmental quadrant
  staircase?: EgressRoute; // Assigned or used egress route
  musterZone?: MusterZone; // Assembly point designation
  lastSeen: string; // Timestamp of last status update
  alertNote?: string; // Free-text distress note (DOMPurify sanitized)
  fallDetected?: boolean; // On-device accelerometer fall sensor (OSHA 1910.38(c)(1))
  mobilityImpaired?: boolean; // ARA-eligible individual (cannot use stairs)
  isAtARA?: boolean; // Currently staged at Area of Rescue Assistance
  drillParticipant?: boolean; // OSHA 1910.38(e) drill participation tracking
}

export interface LedgerBlock {
  index: number;
  timestamp: string;
  event: string;
  prevHash: string;
  hash: string;
}

export interface DrillHistoryItem {
  id: string;
  date: string;
  duration: number; // in seconds
  totalOccupants: number;
  safeCount: number;
  unaccountedCount: number;
  complianceRate: number; // percentage
  narrative: string;
}
