import { Platform } from "react-native";
import {
  GoogleOneTapSignIn,
  isCancelledResponse,
  isNoSavedCredentialFoundResponse,
  isSuccessResponse,
} from "react-native-nitro-google-signin";

import { createGoogleNonce } from "./googleNonce";

export class GoogleSignInCancelledError extends Error {
  constructor() {
    super("Connexion Google annulée.");
    this.name = "GoogleSignInCancelledError";
  }
}

export class GoogleNativeUnavailableError extends Error {
  constructor(message = "La connexion Google native n'est pas disponible sur cet appareil.") {
    super(message);
    this.name = "GoogleNativeUnavailableError";
  }
}

export async function getNativeGoogleIdToken(): Promise<{ idToken: string; nonce: string }> {
  if (Platform.OS !== "android") throw new GoogleNativeUnavailableError();

  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();
  if (!webClientId) {
    throw new GoogleNativeUnavailableError(
      "Le Client ID Web Google manque dans cette version de l'application.",
    );
  }

  const nonce = await createGoogleNonce();
  GoogleOneTapSignIn.configure({ webClientId, nonce: nonce.sha256, autoSelectOnSignIn: false });
  await GoogleOneTapSignIn.checkPlayServices(true);

  let response = await GoogleOneTapSignIn.signIn();
  if (isNoSavedCredentialFoundResponse(response)) response = await GoogleOneTapSignIn.createAccount();
  if (isNoSavedCredentialFoundResponse(response)) {
    response = await GoogleOneTapSignIn.presentExplicitSignIn();
  }

  if (isCancelledResponse(response)) throw new GoogleSignInCancelledError();
  if (!isSuccessResponse(response) || !response.data.idToken) {
    throw new Error("Google n'a pas renvoyé de jeton de connexion.");
  }
  return { idToken: response.data.idToken, nonce: nonce.raw };
}

export async function signOutNativeGoogle(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    await GoogleOneTapSignIn.signOut();
  } catch {
    // La déconnexion Supabase reste prioritaire.
  }
}
