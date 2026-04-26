import type { AppState } from "./store";
import { loadHouseholdState, saveHouseholdState } from "./repository";

const MIGRATION_KEY = "placa-netto-cloud-migration-v1";

export async function migrateLocalToCloudOnce(householdId: string, localState: AppState) {
  if (typeof window === "undefined") return;
  const marker = window.localStorage.getItem(MIGRATION_KEY);
  if (marker === "done") return;

  const cloudState = await loadHouseholdState(householdId);
  const hasCloudData =
    (cloudState.spouses?.length ?? 0) > 0 ||
    (cloudState.expenses?.length ?? 0) > 0 ||
    (cloudState.investments?.length ?? 0) > 0 ||
    (cloudState.loans?.length ?? 0) > 0 ||
    (cloudState.rentals?.length ?? 0) > 0;

  if (!hasCloudData) {
    await saveHouseholdState(householdId, localState);
  }
  window.localStorage.setItem(MIGRATION_KEY, "done");
}
