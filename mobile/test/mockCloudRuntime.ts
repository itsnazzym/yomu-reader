import * as SecureStore from "expo-secure-store";

export const fixture = { providerFails: false, readFails: false, stopped: 0, signedOut: 0, nativeOut: 0 };
export const capturedStorages: { setItem(key: string, value: string): Promise<void> }[] = [];
export function maybeCompleteAuthSession() {}
export async function openAuthSessionAsync() { return { type: "cancel" }; }
export async function createBackupPayload() { return {}; }
export async function restoreBackupFromJson() {}
export class GoogleNativeUnavailableError extends Error {}
export async function getNativeGoogleIdToken() { throw new GoogleNativeUnavailableError(); }
export async function signOutNativeGoogle() { fixture.nativeOut++; }
export function createClient(_url: string, _key: string, options: { auth: { storage: { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> } } }) {
  capturedStorages.push(options.auth.storage);
  return {
    auth: {
      async getSession() {
        // Exercise the real service namespace and its known-key tracking.
        await options.auth.storage.getItem("fixture-auth-token");
        if (fixture.readFails) throw new Error("fixture session read failed");
        return { data: { session: { user: { id: "fixture-user" } } } };
      },
      async stopAutoRefresh() { fixture.stopped++; },
      async signOut() {
        fixture.signedOut++;
        return { error: fixture.providerFails ? new Error("fixture provider failed") : null };
      },
    },
  };
}
export async function seedCloudFixture() {
  await SecureStore.setItemAsync("yomu.supabase.fixture-auth-token", "fixture-cloud");
  await SecureStore.setItemAsync("auth.v2.access_token", "fixture-other-service");
  await SecureStore.setItemAsync("yomu.cloud.recovery-key.v1.fixture-user", "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
}
