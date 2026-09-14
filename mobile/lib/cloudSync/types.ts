export type CloudSyncStatus =
  | "unconfigured"
  | "signed_out"
  | "locked"
  | "idle"
  | "syncing"
  | "offline"
  | "error";

export interface CloudSyncState {
  status: CloudSyncStatus;
  email?: string;
  lastSyncedAt?: string;
  message?: string;
}

export interface EncryptedVault {
  nonce: string;
  ciphertext: string;
  schemaVersion: number;
}
