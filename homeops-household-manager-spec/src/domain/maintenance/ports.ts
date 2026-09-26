// HomeOps - domain skeleton (specification phase). Ports only.

import type { Id, LocalDate } from '../../shared/types';
import type { Asset, MaintenancePlan, MaintenanceRecord } from './types';

export type MaintenanceRepository = {
  findPlanById(householdId: Id, planId: Id): Promise<MaintenancePlan | null>;
  listPlans(householdId: Id, options?: { readonly includeArchived?: boolean }): Promise<readonly MaintenancePlan[]>;
  insertPlan(plan: MaintenancePlan): Promise<void>;
  updatePlan(plan: MaintenancePlan): Promise<void>;
  /** Due/lead-time evaluation input: active plans whose next date is within the lead window. */
  listDuePlans(householdId: Id, today: LocalDate): Promise<readonly MaintenancePlan[]>;
  findAssetById(householdId: Id, assetId: Id): Promise<Asset | null>;
  listAssets(householdId: Id, options?: { readonly includeArchived?: boolean }): Promise<readonly Asset[]>;
  insertAsset(asset: Asset): Promise<void>;
  updateAsset(asset: Asset): Promise<void>;
  insertRecord(record: MaintenanceRecord): Promise<void>;
  listRecords(householdId: Id, target: { readonly planId?: Id; readonly assetId?: Id }, limit: number): Promise<readonly MaintenanceRecord[]>;
  /** Consistency sweep input (T-MNT-004): last record per plan, to detect drift. */
  listLastServiceDates(householdId: Id): Promise<ReadonlyMap<Id, LocalDate>>;
};
