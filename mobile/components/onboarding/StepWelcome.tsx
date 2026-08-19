import React from "react";
import { StyleSheet, View, Text } from "react-native";
import {
  IconBook2,
  IconShieldCheck,
  IconCloudDownload,
  IconLock,
} from "@tabler/icons-react-native";
import { useTheme } from "@/lib/ThemeContext";

export function StepWelcome() {
  const { colors } = useTheme();

  const features = [
    {
      icon: IconShieldCheck,
      title: "Contournement DNS & FAI",
      desc: "Accès direct et illimité sans blocage réseau ni configuration complexe.",
    },
    {
      icon: IconCloudDownload,
      title: "Téléchargement Hors-Ligne",
      desc: "Téléchargez des galeries entières en arrière-plan pour les lire partout.",
    },
    {
      icon: IconLock,
      title: "Privé & Stockage Local",
      desc: "Votre historique et vos favoris sont stockés en sécurité sur votre appareil.",
    },
  ];

  return (
    <View style={styles.container}>
      {/* Icon Badge */}
      <View style={[styles.iconBox, { backgroundColor: colors.accent + "18", borderColor: colors.accent + "35" }]}>
        <IconBook2 size={32} color={colors.accent} stroke={1.6} />
      </View>

      <Text style={styles.title}>Bienvenue sur le Launcher</Text>
      <Text style={styles.subtitle}>
        Votre lecteur haute performance pour explorer, lire et archiver vos mangas favoris en toute liberté.
      </Text>

      {/* Feature Pills */}
      <View style={styles.featuresList}>
        {features.map((f, i) => {
          const IconComp = f.icon;
          return (
            <View key={i} style={styles.featureRow}>
              <View style={[styles.featureIconWrap, { backgroundColor: "#1c1c28" }]}>
                <IconComp size={18} color={colors.accent} stroke={1.8} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 8,
  },
  iconBox: {
    width: 68,
    height: 68,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: "900",
    color: "#f3f4f6",
    textAlign: "center",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: "#9ca3af",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 8,
  },
  featuresList: {
    width: "100%",
    gap: 10,
    marginTop: 4,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#161622",
    borderColor: "#28283a",
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 12,
  },
  featureIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  featureTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#f3f4f6",
  },
  featureDesc: {
    fontSize: 11,
    color: "#9ca3af",
    marginTop: 1,
    lineHeight: 15,
  },
});
