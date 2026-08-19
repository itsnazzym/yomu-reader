import React from "react";
import { StyleSheet, View } from "react-native";

interface TexturedBackgroundProps {
  /** Couleur de fond (défaut : noir profond #09090e) */
  backgroundColor?: string;
  intensity?: number;
  children?: React.ReactNode;
}

/**
 * Arrière-plan épuré et ultra-rapide pour l'application.
 * 100% compatible Android Fabric & Bridgeless, sans interférence de gestes tactiles.
 */
export function TexturedBackground({
  backgroundColor = "#09090e",
  children,
}: TexturedBackgroundProps) {
  return (
    <View style={[styles.container, { backgroundColor }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default TexturedBackground;
