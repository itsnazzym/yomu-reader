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

      <Text style={[styles.title, { color: colors.txt }]}>
        {isLoggedIn ? "Compte Connecté !" : "Compte nHentai (Optionnel)"}
      </Text>
      <Text style={[styles.subtitle, { color: colors.sub }]}>
        {isLoggedIn
          ? `Bienvenue ${session.username || ""} ! Vos favoris Cloud seront synchronisés automatiquement.`
          : "La lecture et les téléchargements fonctionnent sans compte. Connectez votre compte si vous souhaitez retrouver vos favoris nHentai."}
      </Text>

      {/* Account action card */}
      <View style={[styles.card, { backgroundColor: colors.page, borderColor: colors.tagBg }]}>
        {isLoggedIn ? (
          <View style={styles.connectedRow}>
            <View style={[styles.userBadge, { backgroundColor: colors.accent }]}>
              <IconUser size={16} color="#fff" stroke={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.connectedName, { color: colors.txt }]}>
                {session.username || "Compte Officiel"}
              </Text>
              <Text style={[styles.connectedSub, { color: colors.sub }]}>
                {session.cloudFavoritesCount || 0} favoris synchronisés
              </Text>
            </View>
            <IconCheck size={18} color="#52c41a" stroke={2.5} />
          </View>
        ) : (
          <Pressable
            onPress={() => setIsSignInOpen(true)}
            style={[styles.loginBtn, { backgroundColor: colors.accent }]}
            accessibilityRole="button"
            accessibilityLabel="Se connecter à mon compte nHentai"
          >
            <IconLogin size={16} color="#fff" stroke={2} />
            <Text style={styles.loginBtnText}>Se connecter à mon compte nHentai</Text>
          </Pressable>
        )}

        <View style={[styles.divider, { backgroundColor: colors.tagBg }]} />

        <Pressable
          onPress={onFinish}
          style={styles.guestBtn}
          accessibilityRole="button"
          accessibilityLabel={isLoggedIn ? "Accéder à la bibliothèque" : "Continuer en mode invité"}
        >
          <Text style={[styles.guestBtnText, { color: colors.sub }]}>
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
    textAlign: "center",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 6,
  },
  card: {
    width: "100%",
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
  },
  connectedSub: {
    fontSize: 11,
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
  },
  guestBtn: {
    alignItems: "center",
    paddingVertical: 4,
  },
  guestBtnText: {
    fontSize: 12.5,
    fontWeight: "700",
  },
});
