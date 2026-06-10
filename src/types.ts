export interface Occupant {
  id: string; // Token (e.g. usr_a7f8c9d1)
  badgeId: string; // e.g. FE019283
  nameEncrypted: string; // e.g. "************" (Tokenization-at-Rest placeholder)
  role: "Warden" | "Occupant" | "Contractor" | "FSD";
  status: "SAFE" | "MISSING" | "NEED_HELP" | "CRITICAL";
  quadrant: "NW" | "NE" | "SW" | "SE" | "Center";
  staircase?: "Stair A" | "Stair B";
  musterZone?: "Zone A" | "Zone B" | "Zone C";
  lastSeen: string;
  alertNote?: string;
  fallDetected?: boolean;
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
