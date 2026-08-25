import React from "react";
import { Text, StyleProp, TextStyle } from "react-native";
import { TEXT_BUTTON, TEXT_CHIP, TEXT_IN_ROW, TEXT_MENU } from "@/lib/safeTextStyles";

export type AppTextVariant = "body" | "button" | "chip" | "menu" | "label";

const VARIANT_BASE: Record<AppTextVariant, TextStyle> = {
  body: TEXT_IN_ROW,
  button: TEXT_BUTTON,
  chip: TEXT_CHIP,
  menu: TEXT_MENU,
  label: TEXT_IN_ROW,
};

export interface AppTextProps {
  children: React.ReactNode;
  variant?: AppTextVariant;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  ellipsizeMode?: "head" | "middle" | "tail" | "clip";
  color?: string;
}

/**
 * Texte générique avec contraintes flex sûres pour boutons, chips et labels.
 */
export function AppText({
  children,
  variant = "body",
  style,
  numberOfLines,
  ellipsizeMode,
  color,
}: AppTextProps) {
  return (
    <Text
      style={[VARIANT_BASE[variant], color ? { color } : null, style]}
      numberOfLines={numberOfLines}
      ellipsizeMode={numberOfLines ? (ellipsizeMode ?? "tail") : ellipsizeMode}
    >
      {children}
    </Text>
  );
}
