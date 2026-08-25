import React from "react";
import { Text, StyleProp, TextStyle } from "react-native";
import { TAG_LABEL_VARIANTS, type TagLabelVariant } from "@/lib/tagDisplay";

export interface TagLabelProps {
  name: string;
  color?: string;
  variant?: TagLabelVariant;
  style?: StyleProp<TextStyle>;
  /** Préfixe affiché avant le nom (+, −, type:, etc.) */
  prefix?: string;
}

/**
 * Texte de tag unifié — empêche le rognage de lettres sur Android
 * (flexShrink, minWidth, pas de includeFontPadding).
 */
export function TagLabel({
  name,
  color,
  variant = "chip",
  style,
  prefix,
}: TagLabelProps) {
  const preset = TAG_LABEL_VARIANTS[variant];
  const label = prefix ? `${prefix}${name}` : name;

  return (
    <Text
      style={[preset.base, color ? { color } : null, style]}
      numberOfLines={preset.numberOfLines}
      ellipsizeMode={preset.numberOfLines ? "tail" : undefined}
    >
      {label}
    </Text>
  );
}
