import React from "react";
import {
  Modal,
  StyleSheet,
  View,
  Text,
  Pressable,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/ThemeContext";
import { CardPressable } from "@/components/ui/CardPressable";
import { openAppSettings } from "@/lib/permissions";

interface PermissionModalProps {
  visible: boolean;
  onGrant: () => void;
  onDismiss: () => void;
  title?: string;
  description?: string;
  icon?: string;
  isPermanentlyDenied?: boolean;
}

export function PermissionModal({
  visible,
  onGrant,
  onDismiss,
  title = "Autorisation de stockage requise",
  description = "Pour télécharger et stocker des mangas sur votre appareil afin de les lire hors connexion, l'application a besoin de l'accès au stockage.",
  icon = "folder",
  isPermanentlyDenied = false,
}: PermissionModalProps) {
  const { colors } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.box,
            { backgroundColor: colors.page, borderColor: colors.tagBg },
          ]}
        >
          <View style={[styles.iconCircle, { backgroundColor: colors.accent + "20" }]}>
            <Feather name={icon as any} size={32} color={colors.accent} />
          </View>

          <Text style={[styles.title, { color: colors.txt }]}>{title}</Text>
          <Text style={[styles.desc, { color: colors.sub }]}>{description}</Text>

          <View style={styles.actions}>
            {isPermanentlyDenied ? (
              <CardPressable
                onPress={openAppSettings}
                radius={12}
                style={[styles.grantBtn, { backgroundColor: colors.accent }]}
              >
                <View style={styles.btnContent}>
                  <Feather name="settings" size={16} color="#fff" />
                  <Text style={styles.grantBtnText}>Ouvrir les Paramètres</Text>
                </View>
              </CardPressable>
            ) : (
              <CardPressable
                onPress={onGrant}
                radius={12}
                style={[styles.grantBtn, { backgroundColor: colors.accent }]}
              >
                <View style={styles.btnContent}>
                  <Feather name="check-circle" size={16} color="#fff" />
                  <Text style={styles.grantBtnText}>Accorder l'autorisation</Text>
                </View>
              </CardPressable>
            )}

            <Pressable onPress={onDismiss} style={styles.dismissBtn}>
              <Text style={[styles.dismissText, { color: colors.sub }]}>
                Plus tard
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  box: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 20,
    borderWidth: 1,
    padding: 22,
    alignItems: "center",
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 8,
  },
  desc: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    marginBottom: 20,
  },
  actions: {
    width: "100%",
    gap: 8,
  },
  grantBtn: {
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  btnContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  grantBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
  },
  dismissBtn: {
    paddingVertical: 8,
    alignItems: "center",
  },
  dismissText: {
    fontSize: 13,
    fontWeight: "600",
  },
});

export default PermissionModal;
