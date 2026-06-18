import { Occupant, LedgerBlock } from "./types";

// Initial tokenized occupant roster simulating Floor 7 occupants (Pilot team of ConEdison, 4 Irving Plaza)
// They are "Tokenized-at-Rest" (names replaced with GUIDs, shown as masked strings initially).
export const INITIAL_OCCUPANTS: Occupant[] = [
  {
    id: "usr_a7f8c9d1",
    badgeId: "NW449210",
    nameEncrypted: "J••• D••", // Masked initially (Vault tokenization simulation)
    role: "Warden",
    status: "SAFE",
    quadrant: "NW",
    staircase: "Stair A",
    musterZone: "Zone A",
    lastSeen: "10:02 AM",
    fallDetected: false
  },
  {
    id: "usr_f9e3c2b8",
    badgeId: "FA018239",
    nameEncrypted: "B•• J••••",
    role: "Contractor",
    status: "MISSING",
    quadrant: "Center",
    lastSeen: "09:55 AM",
    fallDetected: false
  },
  {
    id: "usr_b3c7d6e5",
    badgeId: "HR551109",
    nameEncrypted: "A•••• S••••",
    role: "Occupant",
    status: "NEED_HELP",
    quadrant: "NE",
    lastSeen: "10:04 AM",
    alertNote: "Fume inhalation near breakroom, assisting with mobility.",
    fallDetected: false
  },
  {
    id: "usr_d4e3f2a1",
    badgeId: "LS990011",
    nameEncrypted: "M••••• L••",
    role: "FSD",
    status: "SAFE",
    quadrant: "Center",
    staircase: "Stair A",
    musterZone: "Zone A",
    lastSeen: "10:00 AM",
    fallDetected: false
  },
  {
    id: "usr_c1b2a3d4",
    badgeId: "NW112233",
    nameEncrypted: "C••••• J••••••",
    role: "Occupant",
    status: "MISSING",
    quadrant: "NW",
    lastSeen: "09:58 AM",
    fallDetected: false
  },
  {
    id: "usr_e5f6a7b8",
    badgeId: "FI338822",
    nameEncrypted: "D•••• M•••••",
    role: "Occupant",
    status: "CRITICAL",
    quadrant: "SE",
    lastSeen: "10:05 AM",
    alertNote: "On-Device fall sensor triggered.",
    fallDetected: true
  }
];

// Seed ledger blocks (Hash-Chained Ledger)
export const SEED_LEDGER: LedgerBlock[] = [
  {
    index: 0,
    timestamp: "2026-05-28T10:00:00Z",
    event: "Alarm triggered on Floor 7 (Pilot Phase). Fire Command System online.",
    prevHash: "0000000000000000000000000000000000000000000000000000000000000000",
    hash: "6e2e50550c6204b77f27af851532f83138b320876189daabc7cd23ebf90b0d62"
  },
  {
    index: 1,
    timestamp: "2026-05-28T10:02:15Z",
    event: "Occupant token usr_a7f8c9d1 (Warden) scanned badge at Stair A NFC gate: SAFE.",
    prevHash: "6e2e50550c6204b77f27af851532f83138b320876189daabc7cd23ebf90b0d62",
    hash: "f4007bbf519ff7f99ee70bfbdfce09f6eeb62f3a469446d376ca743ec9ef906a"
  },
  {
    index: 2,
    timestamp: "2026-05-28T10:04:10Z",
    event: "Occupant token usr_b3c7d6e5 updated status: NEED_HELP. Fume alert logged.",
    prevHash: "f4007bbf519ff7f99ee70bfbdfce09f6eeb62f3a469446d376ca743ec9ef906a",
    hash: "fbbf56edbcf52ae2e2764bbf63be1da4efba293818de77678ca902bcfaaeef90"
  }
];

export const MUSTER_ZONES = [
  { id: "Zone A", label: "Zone A - Union Square Park", desc: "Main Assembly Area [RECOMMENDED]" },
  { id: "Zone B", label: "Zone B - Irving Pl & 14th", desc: "Secondary South Assembly" },
  { id: "Zone C", label: "Zone C - Irving Pl & 15th", desc: "Tertiary North Assembly" }
];
