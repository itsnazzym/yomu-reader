import React, { useState } from "react";
import { StyleSheet, View, Text, Pressable } from "react-native";
import {
  IconCircleCheck,
  IconUserCheck,
  IconUser,
  IconCheck,
  IconLogin,
} from "@tabler/icons-react-native";
import { useTheme } from "@/lib/ThemeContext";
import { useAccount } from "@/lib/accountStore";
import { SignInModal } from "@/components/modals/SignInModal";

interface StepAccountProps {
  onFinish: () => void;
}

export function StepAccount({ onFinish }: StepAccountProps) {
  const { colors } = useTheme();
  const { isLoggedIn, session } = useAccount();
  const [isSignInOpen, setIsSignInOpen] = useState(false);

  return (
    <View style={styles.container}>
      <View style={[styles.iconBox, { backgroundColor: colors.accent + "18", borderColor: colors.accent + "35" }]}>
        {isLoggedIn ? (
          <IconCircleCheck size={30} color={colors.accent} stroke={1.8} />
        ) : (
          <IconUserCheck size={30} color={colors.accent} stroke={1.8} />
        )}
      </View>

      <Text style={styles.title}>
        {isLoggedIn ? "Compte Connecté !" : "Compte nHentai (Optionnel)"}
      </Text>
      <Text style={styles.subtitle}>
        {isLoggedIn
          ? `Bienvenue ${session.username || ""} ! Vos favoris Cloud seront synchronisés automatiquement.`
          : "La lecture et les téléchargements fonctionnent sans compte. Connectez votre compte si vous souhaitez retrouver vos favoris nHentai."}
      </Text>

      {/* Account action card */}
      <View style={styles.card}>
        {isLoggedIn ? (
          <View style={styles.connectedRow}>
            <View style={[styles.userBadge, { backgroundColor: colors.accent }]}>
              <IconUser size={16} color="#fff" stroke={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.connectedName}>{session.username || "Compte Officiel"}</Text>
              <Text style={styles.connectedSub}>{session.cloudFavoritesCount || 0} favoris synchronisés</Text>
            </View>
            <IconCheck size={18} color="#52c41a" stroke={2.5} />
          </View>
        ) : (
          <Pressable
            onPress={() => setIsSignInOpen(true)}
            style={[styles.loginBtn, { backgroundColor: colors.accent }]}
          >
            <IconLogin size={16} color="#fff" stroke={2} />
            <Text style={styles.loginBtnText}>Se connecter à mon compte nHentai</Text>
          </Pressable>
        )}

        <View style={styles.divider} />

        <Pressable onPress={onFinish} style={styles.guestBtn}>
          <Text style={styles.guestBtnText}>
            {isLoggedIn ? "Accéder à la Bibliothèque →" : "Continuer en mode Invité (Local) →"}
          </Text>
        </Pressable>
      </View>

      {/* Sign in Modal */}
      <SignInModal
        visible={isSignInOpen}
        onClose={() => setIsSignInOpen(false)}
        onSuccess={() => {
          setIsSignInOpen(false);
          onFinish();
        }}
      />
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
    marginBottom: 6,
  },
  card: {
    width: "100%",
    backgroundColor: "#161622",
    borderColor: "#28283a",
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  connectedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  userBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  connectedName: {
    fontSize: 14,
    fontWeight: "800",
    color: "#f3f4f6",
  },
  connectedSub: {
    fontSize: 11,
    color: "#9ca3af",
    marginTop: 1,
  },
  loginBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
  },
  loginBtnText: {
    color: "#fff",
    fontSize: 13.5,
    fontWeight: "800",
  },
  divider: {
    height: 1,
    backgroundColor: "#28283a",
  },
  guestBtn: {
    alignItems: "center",
    paddingVertical: 4,
  },
  guestBtnText: {
    color: "#9ca3af",
    fontSize: 12.5,
    fontWeight: "700",
  },
});
