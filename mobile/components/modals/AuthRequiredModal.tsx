import React from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { IconHeart, IconLogin, IconUserPlus, IconX } from "@tabler/icons-react-native";
import { useTheme } from "@/lib/ThemeContext";

export interface AuthRequiredModalProps {
  visible: boolean;
  onClose: () => void;
  onSignIn: () => void;
  onRegister: () => void;
  title?: string;
  description?: string;
}

export function AuthRequiredModal({
  visible,
  onClose,
  onSignIn,
  onRegister,
  title = "Connectez-vous pour ajouter cet élément à vos favoris.",
  description = "Les favoris du compte sont synchronisés avec nHentai. Les signets locaux restent disponibles sans connexion.",
}: AuthRequiredModalProps) {
  const { colors } = useTheme();

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.box, { backgroundColor: colors.page, borderColor: colors.tagBg }]}>
          <View style={[styles.iconCircle, { backgroundColor: "#f43f5e20" }]}>
            <IconHeart size={26} color="#f43f5e" stroke={1.8} />
          </View>
          <Text style={[styles.title, { color: colors.txt }]}>{title}</Text>
          <Text style={[styles.desc, { color: colors.sub }]}>{description}</Text>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={onSignIn}
            style={[styles.primary, { backgroundColor: colors.accent }]}
            accessibilityRole="button"
            accessibilityLabel="Se connecter"
          >
            <IconLogin size={16} color="#fff" stroke={2} />
            <Text style={styles.primaryText}>Se connecter</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={onRegister}
            style={[styles.secondary, { borderColor: colors.tagBg, backgroundColor: colors.bg }]}
            accessibilityRole="button"
            accessibilityLabel="Créer un compte"
          >
            <IconUserPlus size={16} color={colors.accent} stroke={2} />
            <Text style={[styles.secondaryText, { color: colors.txt }]}>Créer un compte</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onClose}
            style={styles.cancel}
            accessibilityRole="button"
            accessibilityLabel="Annuler"
          >
            <IconX size={14} color={colors.sub} stroke={2} />
            <Text style={[styles.cancelText, { color: colors.sub }]}>Annuler</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.62)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  box: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
    alignItems: "center",
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 8,
  },
  desc: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    marginBottom: 16,
  },
  primary: {
    width: "100%",
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  secondary: {
    width: "100%",
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 8,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryText: { fontWeight: "800", fontSize: 14 },
  cancel: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
  },
  cancelText: { fontWeight: "700", fontSize: 13 },
});
