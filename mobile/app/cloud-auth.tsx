import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useTheme } from "@/lib/ThemeContext";
import { completeCloudAuthCallback } from "@/lib/cloudSync";
import { ButtonLabel } from "@/components/ui/ButtonLabel";

/** Écran de retour Google : présent pour qu'Expo Router ne tombe jamais sur +not-found. */
export default function CloudAuthScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const url = Linking.useURL();
  const [message, setMessage] = useState("Connexion sécurisée en cours…");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!url) return;
    void completeCloudAuthCallback(url)
      .then(() => router.replace("/settings"))
      .catch((error) => {
        setFailed(true);
        setMessage(error instanceof Error ? error.message : "Connexion Google impossible.");
      });
  }, [router, url]);

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      {!failed && <ActivityIndicator size="large" color={colors.accent} />}
      <Text style={[styles.title, { color: colors.txt }]}>{message}</Text>
      {failed && (
        <Pressable onPress={() => router.replace("/settings")} style={[styles.button, { backgroundColor: colors.accent }]}>
          <ButtonLabel style={styles.buttonText}>Retour aux réglages</ButtonLabel>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 18 },
  title: { maxWidth: 320, textAlign: "center", fontSize: 16, lineHeight: 22, fontWeight: "700" },
  button: { minHeight: 46, borderRadius: 10, paddingHorizontal: 18, alignItems: "center", justifyContent: "center" },
  buttonText: { color: "#fff", fontWeight: "800" },
});
