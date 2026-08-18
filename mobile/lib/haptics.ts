import * as Haptics from "expo-haptics";

/**
 * Retour haptique centralisé — seul module autorisé à importer expo-haptics.
 *
 * Tous les appels :
 * - sont fire-and-forget (aucun blocage du fil JS, `.catch()` silencieux) ;
 * - inoffensifs sur le web ou sans support matériel.
 *
 * Règle projet : ne JAMAIS importer expo-haptics ailleurs (latence
 * 50-150 ms Android si appel bloquant) — passer par ces helpers nommés.
 */

function run(fn: () => Promise<void>): void {
  try {
    void fn().catch(() => {});
  } catch {}
}

/** Léger retour au tap (chips, tags, liens). */
export function lightTap(): void {
  run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

/** Impact moyen (actions principales : partage système, etc.). */
export function mediumImpact(): void {
  run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

/** Notification de succès (copie réussie, action validée). */
export function successFeedback(): void {
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}
