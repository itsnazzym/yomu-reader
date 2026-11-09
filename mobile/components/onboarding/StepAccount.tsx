import React, { useEffect, useState } from "react";
import { Alert, StyleSheet, View, Text, Pressable } from "react-native";
import {
  IconCircleCheck,
  IconUserCheck,
  IconUser,
  IconCheck,
  IconLogin,
  IconCloud,
} from "@tabler/icons-react-native";
import { useTheme } from "@/lib/ThemeContext";
import { useAccount } from "@/lib/accountStore";
import { SignInModal } from "@/components/modals/SignInModal";
import { ButtonLabel } from "@/components/ui/ButtonLabel";
import {
  connectWithGoogle,
  connectWithGoogleBrowser,
  getCloudSyncState,
  isCloudSyncConfigured,
  refreshCloudSyncState,
  subscribeCloudSync,
} from "@/lib/cloudSync";

interface StepAccountProps {
  onFinish: () => void;
}

export function StepAccount({ onFinish }: StepAccountProps) {
  const { colors } = useTheme();
  const { isLoggedIn, session } = useAccount();
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [cloudState, setCloudState] = useState(getCloudSyncState());
  const [cloudBusy, setCloudBusy] = useState(false);

  useEffect(() => {
    void refreshCloudSyncState();
    return subscribeCloudSync(() => setCloudState(getCloudSyncState()));
  }, []);

  const connectCloud = async () => {
    setCloudBusy(true);
    try {
      await connectWithGoogle();
    } catch (error) {
      Alert.alert("Yomu Cloud", error instanceof Error ? error.message : "Connexion Google impossible.");
    } finally {
      setCloudBusy(false);
    }
  };

  const connectCloudInBrowser = async () => {
    setCloudBusy(true);
    try {
      await connectWithGoogleBrowser();
    } catch (error) {
      Alert.alert("Yomu Cloud", error instanceof Error ? error.message : "Connexion Google impossible.");
    } finally {
      setCloudBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.iconBox, { backgroundColor: colors.accent + "18", borderColor: colors.accent + "35" }]}>
        {isLoggedIn ? (
          <IconCircleCheck size={30} color={colors.accent} strokeWidth={1.8} />
        ) : (
          <IconUserCheck size={30} color={colors.accent} strokeWidth={1.8} />
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
              <IconUser size={16} color="#fff" strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.connectedName, { color: colors.txt }]}>
                {session.username || "Compte Officiel"}
              </Text>
              <Text style={[styles.connectedSub, { color: colors.sub }]}>
                {session.cloudFavoritesCount || 0} favoris synchronisés
              </Text>
            </View>
            <IconCheck size={18} color="#52c41a" strokeWidth={2.5} />
          </View>
        ) : (
          <Pressable
            onPress={() => setIsSignInOpen(true)}
            style={[styles.loginBtn, { backgroundColor: colors.accent }]}
            accessibilityRole="button"
            accessibilityLabel="Se connecter à mon compte nHentai"
          >
            <IconLogin size={16} color="#fff" strokeWidth={2} />
            <ButtonLabel style={styles.loginBtnText}>Se connecter à mon compte nHentai</ButtonLabel>
          </Pressable>
        )}

        <View style={[styles.divider, { backgroundColor: colors.tagBg }]} />

        {isCloudSyncConfigured() && (
          <>
            <Pressable
              onPress={() => void connectCloud()}
              disabled={cloudBusy || cloudState.status === "idle" || cloudState.status === "locked"}
              style={({ pressed }) => [
                styles.cloudBtn,
                { borderColor: colors.tagBg, opacity: pressed || cloudBusy ? 0.75 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Connecter Yomu Cloud avec Google"
            >
              <IconCloud size={16} color={colors.txt} strokeWidth={2} />
              <ButtonLabel style={[styles.cloudBtnText, { color: colors.txt }]}>
                {cloudBusy
                  ? "Connexion Google…"
                  : cloudState.status === "idle" || cloudState.status === "locked"
                  ? `Yomu Cloud · ${cloudState.email || "connecté"}`
                  : "Configurer Yomu Cloud avec Google"}
              </ButtonLabel>
            </Pressable>
            <Text style={[styles.cloudHint, { color: colors.sub }]}>
              Facultatif — passkey et verrouillage de l'appareil pris en charge par Google.
            </Text>
            {cloudState.status !== "idle" && cloudState.status !== "locked" ? (
              <Pressable
                onPress={() => void connectCloudInBrowser()}
                disabled={cloudBusy}
                style={({ pressed }) => [styles.cloudBrowserBtn, { opacity: pressed || cloudBusy ? 0.7 : 1 }]}
                accessibilityRole="button"
                accessibilityLabel="Se connecter à Yomu Cloud avec Google dans le navigateur"
              >
                <ButtonLabel style={[styles.cloudBrowserBtnText, { color: colors.sub }]}>Utiliser le navigateur</ButtonLabel>
              </Pressable>
            ) : null}
            <View style={[styles.divider, { backgroundColor: colors.tagBg }]} />
          </>
        )}

        <Pressable
          onPress={onFinish}
          style={styles.guestBtn}
          accessibilityRole="button"
          accessibilityLabel={isLoggedIn ? "Accéder à la bibliothèque" : "Continuer en mode invité"}
        >
          <ButtonLabel style={[styles.guestBtnText, { color: colors.sub }]}>
            {isLoggedIn ? "Accéder à la Bibliothèque →" : "Continuer en mode Invité (Local) →"}
          </ButtonLabel>
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
    minHeight: 48,
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
  cloudBtn: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 10,
  },
  cloudBtnText: { fontSize: 12.5, fontWeight: "800" },
  cloudHint: { fontSize: 11, textAlign: "center", lineHeight: 15 },
  cloudBrowserBtn: { minHeight: 28, alignItems: "center", justifyContent: "center" },
  cloudBrowserBtnText: { fontSize: 11.5, fontWeight: "700", textDecorationLine: "underline" },
  divider: {
    height: 1,
  },
  guestBtn: {
    minHeight: 48,
    alignItems: "center",
    paddingVertical: 4,
  },
  guestBtnText: {
    fontSize: 12.5,
    fontWeight: "700",
  },
});
