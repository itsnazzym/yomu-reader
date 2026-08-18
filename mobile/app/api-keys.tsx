import React, { useCallback, useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Modal,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/ThemeContext";
import { useAccount } from "@/lib/accountStore";
import { ApiKeyItem, createApiKey, deleteApiKey, listApiKeys } from "@/lib/apiKeysStore";
import { CardPressable } from "@/components/ui/CardPressable";
import { IconBtn } from "@/components/ui/IconBtn";
import { SignInModal } from "@/components/modals/SignInModal";

export default function ApiKeysScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAccount();

  // La gestion des clés exige une session refresh_token (une clé API ne peut
  // pas en créer d'autres).
  const canManage =
    session.isLoggedIn &&
    session.credentialType === "refresh" &&
    !/^auth_\d+$/.test(session.sessionId || "");

  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [isSignInOpen, setIsSignInOpen] = useState(false);

  const load = useCallback(async () => {
    if (!canManage) return;
    setLoading(true);
    setError(null);
    try {
      setKeys(await listApiKeys());
    } catch (err: any) {
      setError(err?.message || "Impossible de charger les clés.");
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    const clean = name.trim();
    if (!clean) {
      Alert.alert("Requis", "Donnez un nom à cette clé.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await createApiKey(clean);
      setCreatedKey(res.key);
      setName("");
      await load();
    } catch (err: any) {
      Alert.alert("Échec de la création", err?.message || "Erreur inconnue.");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = (item: ApiKeyItem) => {
    Alert.alert(
      "Supprimer la clé",
      `La clé « ${item.name} » (${item.key_prefix}…) sera définitivement révoquée sur nhentai.net. Continuer ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Révoquer",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteApiKey(item.id);
              await load();
            } catch (err: any) {
              Alert.alert("Échec de la suppression", err?.message || "Erreur inconnue.");
            }
          },
        },
      ]
    );
  };

  const renderKeyCard = (item: ApiKeyItem) => (
    <View
      key={item.id}
      style={[styles.keyCard, { backgroundColor: colors.page, borderColor: colors.tagBg }]}
    >
      <View style={styles.keyRow}>
        <Feather name="key" size={16} color={colors.accent} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.keyName, { color: colors.txt }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.keyMeta, { color: colors.sub }]}>
            {item.key_prefix}… · créée le{" "}
            {new Date(item.created_at * 1000).toLocaleDateString("fr-FR")}
          </Text>
        </View>
        <IconBtn onPress={() => handleDelete(item)} size={34} highlightColor="rgba(255,71,87,0.15)">
          <Feather name="trash-2" size={16} color="#ff4757" />
        </IconBtn>
      </View>
    </View>
  );

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.bg, paddingTop: Math.max(insets.top, 12) },
      ]}
    >
      <View style={[styles.header, { borderBottomColor: colors.tagBg }]}>
        <IconBtn onPress={() => router.back()} size={36} style={styles.backBtn}>
          <Feather name="arrow-left" size={18} color={colors.txt} />
        </IconBtn>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.txt }]}>Clés API</Text>
          <Text style={[styles.headerSub, { color: colors.sub }]}>
            {canManage ? `${keys.length} clé(s) sur nhentai.net` : "Gestion du compte officiel"}
          </Text>
        </View>
      </View>

      {!canManage ? (
        <View style={styles.centerBox}>
          <Feather name="key" size={44} color={colors.sub} style={{ opacity: 0.5 }} />
          <Text style={[styles.emptyTitle, { color: colors.txt }]}>
            Connexion refresh_token requise
          </Text>
          <Text style={[styles.emptySub, { color: colors.sub }]}>
            La gestion des clés API passe par votre compte nhentai.net et nécessite votre
            refresh_token (une clé API ne peut pas en créer d'autres). Connectez-vous avec
            l'option « refresh_token » pour créer, lister et révoquer vos clés ici même.
          </Text>
          <CardPressable
            radius={12}
            onPress={() => setIsSignInOpen(true)}
            style={[styles.connectBtn, { backgroundColor: colors.accent }]}
          >
            <View style={styles.connectBtnInner}>
              <Feather name="log-in" size={16} color="#fff" />
              <Text style={styles.connectBtnText}>Se connecter</Text>
            </View>
          </CardPressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Création */}
          <View style={[styles.createCard, { backgroundColor: colors.page, borderColor: colors.tagBg }]}>
            <Text style={[styles.sectionTitle, { color: colors.txt }]}>Créer une clé</Text>
            <Text style={[styles.sectionSub, { color: colors.sub }]}>
              La clé complète ne s'affichera qu'une seule fois : copiez-la immédiatement.
            </Text>
            <View style={styles.createRow}>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Nom de la clé (ex: NHApp mobile)"
                placeholderTextColor="#6b7280"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleCreate}
                style={[styles.input, { backgroundColor: colors.tagBg, color: colors.txt }]}
              />
              <CardPressable
                radius={12}
                onPress={handleCreate}
                disabled={creating}
                style={[styles.createBtn, { backgroundColor: colors.accent }]}
              >
                <View style={styles.createBtnInner}>
                  {creating ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Feather name="plus" size={16} color="#fff" />
                  )}
                  <Text style={styles.createBtnText}>{creating ? "Génération..." : "Générer"}</Text>
                </View>
              </CardPressable>
            </View>
          </View>

          {error ? (
            <Text style={[styles.errorText, { color: "#ff4757" }]}>{error}</Text>
          ) : null}

          {/* Liste */}
          <Text style={[styles.sectionTitle, { color: colors.txt, marginTop: 18 }]}>
            Clés existantes
          </Text>
          {loading ? (
            <ActivityIndicator style={{ marginTop: 24 }} color={colors.accent} />
          ) : keys.length === 0 ? (
            <Text style={[styles.emptySub, { color: colors.sub, marginTop: 16 }]}>
              Aucune clé API sur votre compte.
            </Text>
          ) : (
            <View style={{ gap: 10, marginTop: 10 }}>{keys.map(renderKeyCard)}</View>
          )}
        </ScrollView>
      )}

      {/* Affichage unique de la clé créée */}
      <Modal visible={!!createdKey} transparent animationType="fade">
        <View style={styles.backdrop}>
          <View style={[styles.keyModal, { backgroundColor: colors.page, borderColor: colors.tagBg }]}>
            <Feather name="check-circle" size={28} color="#52c41a" />
            <Text style={[styles.keyModalTitle, { color: colors.txt }]}>Clé créée</Text>
            <Text style={[styles.keyModalWarn, { color: colors.sub }]}>
              Copiez cette clé maintenant — elle ne sera plus jamais affichée.
            </Text>
            <Text selectable style={[styles.keyValue, { backgroundColor: colors.tagBg, color: colors.txt }]}>
              {createdKey}
            </Text>
            <Pressable
              onPress={() => setCreatedKey(null)}
              style={[styles.keyModalBtn, { backgroundColor: colors.accent }]}
            >
              <Text style={styles.keyModalBtnText}>J'ai copié la clé</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <SignInModal
        visible={isSignInOpen}
        onClose={() => setIsSignInOpen(false)}
        onSuccess={() => setIsSignInOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  backBtn: {
    marginLeft: -6,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  headerSub: {
    fontSize: 11.5,
    marginTop: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginTop: 6,
    textAlign: "center",
  },
  emptySub: {
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: "center",
  },
  connectBtn: {
    marginTop: 8,
    width: "100%",
    maxWidth: 280,
  },
  connectBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
  },
  connectBtnText: {
    color: "#fff",
    fontSize: 13.5,
    fontWeight: "800",
  },
  createCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginTop: 14,
    gap: 6,
  },
  sectionTitle: {
    fontSize: 13.5,
    fontWeight: "800",
  },
  sectionSub: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  createRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  input: {
    flex: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    fontSize: 13,
  },
  createBtn: {
    borderRadius: 12,
  },
  createBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 14,
    height: 42,
  },
  createBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
  errorText: {
    fontSize: 12.5,
    marginTop: 10,
  },
  keyCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  keyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  keyName: {
    fontSize: 13.5,
    fontWeight: "700",
  },
  keyMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  keyModal: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
    alignItems: "center",
    gap: 8,
  },
  keyModalTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginTop: 4,
  },
  keyModalWarn: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 16,
  },
  keyValue: {
    fontSize: 12,
    borderRadius: 10,
    padding: 12,
    width: "100%",
    textAlign: "center",
  },
  keyModalBtn: {
    borderRadius: 12,
    marginTop: 8,
    width: "100%",
    alignItems: "center",
    paddingVertical: 12,
  },
  keyModalBtnText: {
    color: "#fff",
    fontSize: 13.5,
    fontWeight: "800",
  },
});
