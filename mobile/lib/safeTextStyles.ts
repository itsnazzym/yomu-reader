import type { TextStyle } from "react-native";

/**
 * Fragments de styles sûrs pour Text dans des layouts flex row/chip/bouton.
 * Évite le rognage de glyphes sur Android (pas de includeFontPadding: false,
 * flexShrink: 1 + minWidth: 0 sur les textes contraints).
 */
export const TEXT_IN_ROW: TextStyle = {
  flexShrink: 1,
  minWidth: 0,
};

export const TEXT_BUTTON: TextStyle = {
  flexShrink: 1,
  minWidth: 0,
};

export const TEXT_CHIP: TextStyle = {
  flexShrink: 1,
  minWidth: 0,
};

export const TEXT_MENU: TextStyle = {
  flex: 1,
  flexShrink: 1,
  minWidth: 0,
};

/** Styles de texte interdits — utilisés par ui-audit.cjs */
export const UNSAFE_TEXT_PATTERNS = ["includeFontPadding: false"] as const;
