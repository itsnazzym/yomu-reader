import * as Haptics from "expo-haptics";

/** Léger retour haptique au tap ; silencieux sur le web ou sans support. */
export function lightTap(): void {
  try {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  } catch {}
}
