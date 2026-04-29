import type { AppState } from "./store";
import { loadHouseholdState, saveHouseholdState } from "./repository";

const MIGRATION_KEY_PREFIX = "placa-netto-cloud-migration-v1";

export async function migrateLocalToCloudOnce(
  householdId: string,
  localState: AppState,
  validMemberIds: Set<string> = new Set(),
) {
  if (typeof window === "undefined") return;
  const migrationKey = `${MIGRATION_KEY_PREFIX}:${householdId}`;
  const marker = window.localStorage.getItem(migrationKey);
  if (marker === "done") return;

  const cloudState = await loadHouseholdState(householdId);
  const hasCloudData =
    (cloudState.spouses?.length ?? 0) > 0 ||
    (cloudState.expenses?.length ?? 0) > 0 ||
    (cloudState.investments?.length ?? 0) > 0 ||
    (cloudState.loans?.length ?? 0) > 0 ||
    (cloudState.rentals?.length ?? 0) > 0 ||
    (cloudState.savings?.length ?? 0) > 0 ||
    (cloudState.globalSettings && Object.keys(cloudState.globalSettings).length > 0);

  if (!hasCloudData) {
    try {
      await saveHouseholdState(householdId, localState, validMemberIds);
    } catch (err) {
      console.error("migrateLocalToCloudOnce: save failed, will retry next session:", err);
      return; // don't mark as done - retry next time
    }
  }
  window.localStorage.setItem(migrationKey, "done");
}
