import React from "react";
import { Text, type TextProps } from "react-native";

/**
 * Libellé destiné aux contrôles compacts.
 *
 * Les actions restent sur une ligne sans être remplacées par une ellipse. La
 * taille s'ajuste dans l'espace disponible, tout en respectant l'agrandissement
 * système. Les conteneurs d'actions doivent donc donner une largeur suffisante
 * (et s'empiler lorsqu'ils étaient côte à côte), plutôt que couper le libellé.
 */
export function ButtonLabel({ style, children, ...props }: TextProps): React.ReactElement {
  return (
    <Text
      {...props}
      style={[{ flexShrink: 1, minWidth: 0, textAlign: "center" }, style]}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.55}
      maxFontSizeMultiplier={1.6}
    >
      {children}
    </Text>
  );
}
