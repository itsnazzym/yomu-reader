import React from "react";
import { Text, type TextProps } from "react-native";

/**
 * Libellé destiné aux contrôles compacts.
 *
 * Les actions peuvent revenir à la ligne et gardent une taille lisible.
 * Les conteneurs doivent pouvoir grandir avec le texte et la police système.
 */
export function ButtonLabel({ style, children, ...props }: TextProps): React.ReactElement {
  return (
    <Text
      {...props}
      style={[{ flexShrink: 1, minWidth: 0, textAlign: "center" }, style]}
      maxFontSizeMultiplier={1.6}
    >
      {children}
    </Text>
  );
}
