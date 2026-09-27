// HomeOps - feature skeleton (specification phase). Read-model contract only.

import type { AlertPriority } from '../../shared/types';
import type { RoomListRowDto } from '../rooms/queries';

/**
 * The dashboard is ONE read model composed in parallel from the domain read functions
 * (ARCHITECTURE.md section 10, docs/product/DASHBOARD.md). It is a sink: no module may import it.
 *
 * Fixed section order (DP-6): attention strip -> due today -> overdue -> quick actions ->
 * room status -> low supplies -> maintenance/upcoming -> recent activity. Empty sections are
 * omitted, never rendered with a zero count, and there is no configuration surface for the order.
 */
export type DashboardSnapshot = {
  readonly today: string;
  readonly attentionStrip: readonly {
    readonly alertId: string;
    readonly type: string;
    readonly priority: AlertPriority;
    readonly title: string;
    readonly recipientDisplayName: string;
    readonly action: { readonly label: string; readonly href: string };
  }[];
  readonly dueToday: readonly {
    readonly occurrenceId: string;
    readonly title: string;
    readonly roomName?: string;
    readonly assigneeName?: string;
    readonly inProgress: boolean;
  }[];
  readonly overdue: readonly {
    readonly occurrenceId: string;
    readonly title: string;
    readonly dueOn: string;
    readonly daysOverdue: number;
  }[];
  readonly quickActions: readonly {
    readonly kind: 'COMPLETE_CHORE' | 'TRASH_COLLECTED' | 'USED_ONE' | 'RESTOCK' | 'REPORT_ISSUE';
    readonly label: string;
    readonly targetId?: string;
  }[];
  readonly rooms: readonly RoomListRowDto[];
  readonly lowSupplies: readonly {
    readonly resourceId: string;
    readonly name: string;
    readonly band: 'LOW' | 'CRITICAL';
  }[];
  readonly maintenance: readonly {
    readonly planId: string;
    readonly name: string;
    readonly nextServiceAt: string;
    readonly overdue: boolean;
  }[];
  readonly recentActivity: readonly {
    readonly id: string;
    readonly summary: string;
    readonly occurredAt: string;
    readonly actorName?: string;
  }[];
};

/**
 * Compose the snapshot (FR-DASH-001/006): load sections in parallel, bound each list, and hide
 * empty sections in the view layer rather than the model, so tests can assert the truth.
 * Never sequential per-section queries (PERFORMANCE.md PB-S1), never a cross-household read, and
 * never a member ranking or a "completion rate" (DESIGN.md section 18).
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-DASH-001 - requirements, ADR, design, and tests are listed there.
 */
export async function loadDashboardSnapshot(): Promise<DashboardSnapshot> {
  throw new Error('Not implemented: T-DASH-001');
}
