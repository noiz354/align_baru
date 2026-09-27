// HomeOps — development fixture dataset (T-PLAT-018, docs/testing/TEST-DATA.md §2/§11).
//
// Rule zero from TEST-DATA.md: this data is synthetic. No real person, no real address, no real
// photo, no production-looking host. Every id is a fixed literal so a re-run is idempotent and so a
// failure message can be reproduced from the seed alone.

import type { Id, Instant, LocalDate, Role } from '../../../shared/types';

/** Deterministic, valid-shaped uuid for a fixture row: `00000000-0000-4000-8000-0000000001NN`. */
export function seedId(n: number): Id {
  const hex = n.toString(16).padStart(4, '0');
  return `00000000-0000-4000-8000-00000000${hex}`;
}

/** Fixed creation instant: seeding must not depend on the wall clock (I-XA-005, TEST-DATA §3). */
export const SEED_INSTANT: Instant = '2026-01-05T00:00:00.000Z';

/** Reserved TLD (RFC 6761): a fixture address can never reach a real mailbox. */
export const SEED_EMAIL_DOMAIN = 'homeops.test';

export type SeedUser = {
  readonly id: string; // Better Auth uses text ids (DECISIONS.md 2026-09-27)
  readonly name: string;
  readonly email: string;
};

export type SeedMember = {
  readonly id: Id;
  readonly userId: string;
  readonly displayName: string;
  readonly role: Role;
  /** Omitted by every fixture: no document defines an avatar palette, and a colour literal here
   *  would violate the T-PLAT-015 token gate. Initials are the only avatar (DESIGN-SYSTEM.md §5). */
  readonly avatarColor?: string;
  /** Away members are skipped as recipients unless the alert is URGENT (FR-MEM-009). */
  readonly awayFrom?: LocalDate;
  readonly awayUntil?: LocalDate;
};

export type SeedHousehold = {
  readonly id: Id;
  readonly name: string;
  readonly timezone: string;
  readonly weekStartsOn: 'MONDAY' | 'SUNDAY';
  readonly createdByUserId: string;
  readonly createdByMemberId: Id;
  readonly members: readonly SeedMember[];
};

/* --------------------------------------------------------------------------- HH_MAIN (Asia/Jakarta) */

const SARI = { user: 'seed-user-hh-main-sari', member: seedId(101), name: 'Sari' };
const BUDI = { user: 'seed-user-hh-main-budi', member: seedId(102), name: 'Budi' };
const DITA = { user: 'seed-user-hh-main-dita', member: seedId(103), name: 'Dita' };
const ANDI = { user: 'seed-user-hh-main-andi', member: seedId(104), name: 'Andi' };

/* ------------------------------------------------- HH_CONTROL (America/New_York, similar content) */

const NORA = { user: 'seed-user-hh-control-nora', member: seedId(201), name: 'Nora' };
const FELIX = { user: 'seed-user-hh-control-felix', member: seedId(202), name: 'Felix' };
const MAYA = { user: 'seed-user-hh-control-maya', member: seedId(203), name: 'Maya' };
const JONAS = { user: 'seed-user-hh-control-jonas', member: seedId(204), name: 'Jonas' };

/* ------------------------------------------------------------------- HH_WIDTH (DST both directions) */

const LENI = { user: 'seed-user-hh-width-leni', member: seedId(301), name: 'Leni' };
const TOMAS = { user: 'seed-user-hh-width-tomas', member: seedId(302), name: 'Tomas' };
const HANA = { user: 'seed-user-hh-width-south-hana', member: seedId(311), name: 'Hana' };
const WIREMU = { user: 'seed-user-hh-width-south-wiremu', member: seedId(312), name: 'Wiremu' };

/* --------------------------------------------------------------------------- HH_EMPTY / HH_BUSY */

const RANI = { user: 'seed-user-hh-empty-rani', member: seedId(401), name: 'Rani' };
const PETRA = { user: 'seed-user-hh-busy-petra', member: seedId(501), name: 'Petra' };
const OTTO = { user: 'seed-user-hh-busy-otto', member: seedId(502), name: 'Otto' };
const IVAN = { user: 'seed-user-hh-busy-ivan', member: seedId(503), name: 'Ivan' };

export const SEED_HOUSEHOLDS: readonly SeedHousehold[] = [
  {
    id: seedId(1),
    name: 'HH_MAIN',
    timezone: 'Asia/Jakarta',
    weekStartsOn: 'MONDAY',
    createdByUserId: SARI.user,
    createdByMemberId: SARI.member,
    members: [
      { id: SARI.member, userId: SARI.user, displayName: SARI.name, role: 'OWNER' },
      { id: BUDI.member, userId: BUDI.user, displayName: BUDI.name, role: 'ADMIN' },
      { id: DITA.member, userId: DITA.user, displayName: DITA.name, role: 'MEMBER' },
      {
        id: ANDI.member,
        userId: ANDI.user,
        displayName: ANDI.name,
        role: 'HELPER',
        // One member away during the notification suites (TEST-DATA §2 composition rules).
        awayFrom: '2026-01-05',
        awayUntil: '2026-01-12',
      },
    ],
  },
  {
    // Isolation control: a different timezone and different names, but the *same* chore titles and
    // container names later on, so a leaked query is detectable by content and not only by id.
    id: seedId(2),
    name: 'HH_CONTROL',
    timezone: 'America/New_York',
    weekStartsOn: 'SUNDAY',
    createdByUserId: NORA.user,
    createdByMemberId: NORA.member,
    members: [
      { id: NORA.member, userId: NORA.user, displayName: NORA.name, role: 'OWNER' },
      { id: FELIX.member, userId: FELIX.user, displayName: FELIX.name, role: 'ADMIN' },
      { id: MAYA.member, userId: MAYA.user, displayName: MAYA.name, role: 'MEMBER' },
      { id: JONAS.member, userId: JONAS.user, displayName: JONAS.name, role: 'HELPER' },
    ],
  },
  {
    id: seedId(3),
    name: 'HH_WIDTH',
    timezone: 'Europe/Berlin',
    weekStartsOn: 'MONDAY',
    createdByUserId: LENI.user,
    createdByMemberId: LENI.member,
    members: [
      { id: LENI.member, userId: LENI.user, displayName: LENI.name, role: 'OWNER' },
      { id: TOMAS.member, userId: TOMAS.user, displayName: TOMAS.name, role: 'ADMIN' },
    ],
  },
  {
    // Southern-hemisphere variant of the DST suite, in the same fixture file (TEST-DATA §2).
    id: seedId(4),
    name: 'HH_WIDTH_SOUTH',
    timezone: 'Pacific/Auckland',
    weekStartsOn: 'MONDAY',
    createdByUserId: HANA.user,
    createdByMemberId: HANA.member,
    members: [
      { id: HANA.member, userId: HANA.user, displayName: HANA.name, role: 'OWNER' },
      { id: WIREMU.member, userId: WIREMU.user, displayName: WIREMU.name, role: 'ADMIN' },
    ],
  },
  {
    // Empty-state and onboarding: a household with one owner and nothing else.
    id: seedId(5),
    name: 'HH_EMPTY',
    timezone: 'Asia/Jakarta',
    weekStartsOn: 'MONDAY',
    createdByUserId: RANI.user,
    createdByMemberId: RANI.member,
    members: [{ id: RANI.member, userId: RANI.user, displayName: RANI.name, role: 'OWNER' }],
  },
  {
    // Alert-fatigue and pagination stress. The volumes (~200 open occurrences, 50 low resources,
    // 25 containers, 3 years of activity) need the product tables, so they are listed below as a
    // pending section rather than faked here.
    id: seedId(6),
    name: 'HH_BUSY',
    timezone: 'Asia/Jakarta',
    weekStartsOn: 'MONDAY',
    createdByUserId: PETRA.user,
    createdByMemberId: PETRA.member,
    members: [
      { id: PETRA.member, userId: PETRA.user, displayName: PETRA.name, role: 'OWNER' },
      { id: OTTO.member, userId: OTTO.user, displayName: OTTO.name, role: 'ADMIN' },
      { id: IVAN.member, userId: IVAN.user, displayName: IVAN.name, role: 'MEMBER' },
    ],
  },
];

/** Flattened user rows: one per fixture member, email derived from the display name. */
export const SEED_USERS: readonly SeedUser[] = SEED_HOUSEHOLDS.flatMap((household) =>
  household.members.map((member) => ({
    id: member.userId,
    name: member.displayName,
    email: `${member.userId.replace(/^seed-user-/, '').replaceAll('-', '.')}@${SEED_EMAIL_DOMAIN}`,
  })),
);

/**
 * Fixture content that cannot exist yet, with the task that unlocks it. Requesting one of these
 * sections throws rather than seeding a smaller dataset and reporting success (AGENTS.md §3: no
 * fake implementations). The identity/tenancy sections above are complete for their own scope.
 */
export const PENDING_SEED_SECTIONS = [
  {
    section: 'rooms',
    owningTask: 'T-ROOM-001',
    unlocks: 'two rooms dirty, one clean, one unknown (TEST-DATA §11)',
  },
  { section: 'chores', owningTask: 'T-CHORE-002', unlocks: 'a recurring chore overdue and one due today' },
  { section: 'trash', owningTask: 'T-TRASH-001', unlocks: 'a bin full and one almost full' },
  { section: 'resources', owningTask: 'T-RES-001', unlocks: 'three resources low' },
  { section: 'maintenance', owningTask: 'T-MNT-001', unlocks: 'a maintenance plan due in 4 days' },
  { section: 'issues', owningTask: 'T-ISSUE-001', unlocks: 'one SAFETY issue' },
  { section: 'alerts', owningTask: 'T-ALERT-001', unlocks: 'a snoozed alert and an acknowledged alert' },
  {
    // The stress volumes are the sum of the sections above, so this one completes last; it is
    // owned by the seed task itself and is delivered incrementally (DECISIONS.md 2026-09-27).
    section: 'busy-volumes',
    owningTask: 'T-PLAT-018',
    unlocks:
      'HH_BUSY stress volumes (~200 open occurrences, 50 low resources, 25 containers, 3 years of activity)',
  },
] as const;

export type PendingSeedSection = (typeof PENDING_SEED_SECTIONS)[number]['section'];

export function isPendingSeedSection(value: string): value is PendingSeedSection {
  return PENDING_SEED_SECTIONS.some((entry) => entry.section === value);
}

/** A production-looking connection string is refused even if its database name contains "dev". */
export function looksLikeProductionHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local')) return false;
  return /(prod|production|live|\.aws\.|\.azure\.|\.googleusercontent\.|rds\.amazonaws)/.test(host);
}
