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
  Linking,
  Platform,
} from "react-native";
import {
  IconKey,
  IconTrash,
  IconArrowLeft,
  IconExternalLink,
  IconLogin,
  IconPlus,
  IconCircleCheck,
  IconCheck,
  IconCopy,
  IconShieldCheck,
  IconClipboard,
  IconBolt,
} from "@tabler/icons-react-native";
import * as Clipboard from "expo-clipboard";
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
  const { session, loginWithSession, fetchUserProfile } = useAccount();

  const isAuthed = Boolean(session?.isLoggedIn);
  const isApiKeyActive = Boolean(session?.isLoggedIn && session?.credentialType === "apiKey");

  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [activating, setActivating] = useState(false);
  const [name, setName] = useState("");
  const [manualKeyInput, setManualKeyInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [isSignInOpen, setIsSignInOpen] = useState(false);

  const load = useCallback(async () => {
    if (!isAuthed) {
      setKeys([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await listApiKeys();
      setKeys(Array.isArray(list) ? list : []);
    } catch (err: any) {
      console.warn("[api-keys] load error:", err);
      setError(err?.message || "Impossible de charger les clés.");
    } finally {
      setLoading(false);
    }
  }, [isAuthed]);

  useEffect(() => {
    load();
  }, [load]);

  const handleApplyApiKey = async (rawKey?: string) => {
    const targetKey = (rawKey || manualKeyInput).trim();
    if (!targetKey) {
      Alert.alert("Clé requise", "Veuillez coller ou saisir une clé API nHentai valide.");
      return;
    }

    setActivating(true);
    try {
      await loginWithSession(targetKey, session?.username || "Membre API", "apiKey");
      await fetchUserProfile();
      setManualKeyInput("");
      Alert.alert(
        "Clé API Activée ✧✦",
        "Cette clé API est désormais active pour toutes vos requêtes et chargements de mangas dans l'application."
      );
      await load();
    } catch (err: any) {
      Alert.alert("Erreur d'activation", err?.message || "Impossible d'activer cette clé.");
    } finally {
      setActivating(false);
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) {
        setManualKeyInput(text.trim());
      }
    } catch {}
  };

  const handleCreate = async () => {
    const clean = name.trim();
    if (!clean) {
      Alert.alert("Requis", "Donnez un nom à cette clé (ex: NHApp Mobile).");
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

  const handleCopyKey = async (textToCopy: string) => {
    try {
      await Clipboard.setStringAsync(textToCopy);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } catch {}
  };

  const formatKeyDate = (timestamp: number | undefined) => {
    if (!timestamp) return "récemment";
    try {
      const ms = timestamp > 1e11 ? timestamp : timestamp * 1000;
      const d = new Date(ms);
      if (isNaN(d.getTime())) return "récemment";
      return d.toLocaleDateString("fr-FR");
    } catch {
      return "récemment";
    }
  };

  const renderKeyCard = (item: ApiKeyItem) => {
    const prefix = String(item.key_prefix || "");
    const isCurrentActive = false;

    return (
      <View
        key={item.id}
        style={[
          styles.keyCard,
          {
            backgroundColor: colors.page,
            borderColor: isCurrentActive ? colors.accent : colors.tagBg,
            borderWidth: isCurrentActive ? 1.5 : 1,
          },
        ]}
      >
        <View style={styles.keyRow}>
          <View
            style={[
              styles.keyIconCircle,
              { backgroundColor: isCurrentActive ? "rgba(168,85,247,0.18)" : colors.tagBg },
            ]}
          >
            <IconKey size={18} color={isCurrentActive ? colors.accent : colors.sub} strokeWidth={1.8} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={[styles.keyName, { color: colors.txt }]} numberOfLines={1}>
                {item.name}
              </Text>
              {isCurrentActive && (
                <View style={[styles.activeBadge, { backgroundColor: colors.accent }]}>
                  <Text style={styles.activeBadgeText}>ACTIVE</Text>
                </View>
              )}
            </View>
            <Text style={[styles.keyMeta, { color: colors.sub }]}>
              {prefix}… · créée le {formatKeyDate(item.created_at)}
            </Text>
          </View>
          <IconBtn
            onPress={() => handleDelete(item)}
            size={34}
            highlightColor="rgba(255,71,87,0.15)"
          >
            <IconTrash size={16} color="#ff4757" strokeWidth={1.8} />
          </IconBtn>
        </View>
      </View>
    );
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.bg, paddingTop: Math.max(insets.top, 12) },
      ]}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.tagBg }]}>
        <IconBtn onPress={() => router.back()} size={36} style={styles.backBtn}>
          <IconArrowLeft size={18} color={colors.txt} strokeWidth={2} />
        </IconBtn>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.txt }]}>Clés API nHentai</Text>
          <Text style={[styles.headerSub, { color: colors.sub }]}>
            {isAuthed ? `${keys.length} clé(s) liée(s) à votre compte` : "Authentification rapide par clé"}
          </Text>
        </View>
        <IconBtn
          onPress={() => {
            try {
              Linking.openURL("https://nhentai.net/api/v2/user/keys");
            } catch {}
          }}
          size={36}
          highlightColor="rgba(96, 165, 250, 0.15)"
        >
          <IconExternalLink size={17} color="#60a5fa" strokeWidth={2} />
        </IconBtn>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Status Banner */}
        <View
          style={[
            styles.statusBanner,
            {
              backgroundColor: isApiKeyActive ? "rgba(168,85,247,0.12)" : "rgba(34,197,94,0.10)",
              borderColor: isApiKeyActive ? "rgba(168,85,247,0.3)" : "rgba(34,197,94,0.25)",
            },
          ]}
        >
          {isApiKeyActive ? (
            <>
              <IconBolt size={18} color={colors.accent} strokeWidth={2} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.statusBannerTitle, { color: colors.accent }]}>
                  Mode Clé API Actif
                </Text>
                <Text style={[styles.statusBannerSub, { color: colors.sub }]} numberOfLines={1}>
                  Clé validée et conservée dans le stockage sécurisé Android
                </Text>
              </View>
            </>
          ) : isAuthed ? (
            <>
              <IconShieldCheck size={18} color="#22c55e" strokeWidth={2} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.statusBannerTitle, { color: "#22c55e" }]}>
                  Session Officielle Active ({session?.username || "Connecté"})
                </Text>
                <Text style={[styles.statusBannerSub, { color: colors.sub }]}>
                  Vos clés API sont automatiquement synchronisées avec nhentai.net
                </Text>
              </View>
            </>
          ) : (
            <>
              <IconKey size={18} color="#fbbf24" strokeWidth={2} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.statusBannerTitle, { color: "#fbbf24" }]}>
                  Mode Invité (Clé API possible)
                </Text>
                <Text style={[styles.statusBannerSub, { color: colors.sub }]}>
                  Activez une clé API ci-dessous pour débloquer l'accès sans mot de passe
                </Text>
              </View>
            </>
          )}
        </View>

        {/* 1. Activer directement une clé API */}
        <View style={[styles.card, { backgroundColor: colors.page, borderColor: colors.tagBg }]}>
          <View style={styles.cardHeader}>
            <IconKey size={16} color={colors.accent} strokeWidth={2} />
            <Text style={[styles.sectionTitle, { color: colors.txt }]}>
              Activer une clé
            </Text>
          </View>
          <Text style={[styles.sectionSub, { color: colors.sub }]}>
            Collez une clé API nHentai (`nhk_...`) pour l'intégrer et débloquer les requêtes.
          </Text>

          <View style={styles.inputRow}>
            <TextInput
              value={manualKeyInput}
              onChangeText={setManualKeyInput}
              placeholder="nhk_xxxxxxxxxxxxxxxx..."
              placeholderTextColor="#6b7280"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={() => handleApplyApiKey()}
              style={[styles.input, { backgroundColor: colors.tagBg, color: colors.txt, flex: 1 }]}
            />
            <Pressable
              onPress={handlePasteFromClipboard}
              style={[styles.iconButtonSmall, { backgroundColor: colors.tagBg }]}
            >
              <IconClipboard size={16} color={colors.txt} strokeWidth={1.8} />
            </Pressable>
          </View>

          <CardPressable
            radius={10}
            onPress={() => handleApplyApiKey()}
            disabled={activating || !manualKeyInput.trim()}
            style={[
              styles.actionBtn,
              {
                backgroundColor: manualKeyInput.trim() ? colors.accent : colors.tagBg,
                opacity: manualKeyInput.trim() ? 1 : 0.6,
              },
            ]}
          >
            <View style={styles.btnInner}>
              {activating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <IconCheck size={16} color={manualKeyInput.trim() ? "#fff" : colors.sub} strokeWidth={2.5} />
              )}
              <Text
                style={[
                  styles.btnText,
                  { color: manualKeyInput.trim() ? "#fff" : colors.sub },
                ]}
              >
                {activating ? "Activation..." : "Activer la clé"}
              </Text>
            </View>
          </CardPressable>
        </View>

        {/* 2. Créer une clé (Si connecté au compte) */}
        {isAuthed ? (
          <View style={[styles.card, { backgroundColor: colors.page, borderColor: colors.tagBg }]}>
            <View style={styles.cardHeader}>
              <IconPlus size={16} color={colors.accent} strokeWidth={2.5} />
              <Text style={[styles.sectionTitle, { color: colors.txt }]}>Nouvelle clé</Text>
            </View>
            <Text style={[styles.sectionSub, { color: colors.sub }]}>
              Créera une clé API officielle enregistrée sur votre compte.
            </Text>

            <View style={styles.inputRow}>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Nom (ex: Pixel 8)"
                placeholderTextColor="#6b7280"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleCreate}
                style={[styles.input, { backgroundColor: colors.tagBg, color: colors.txt, flex: 1 }]}
              />
              <CardPressable
                radius={10}
                onPress={handleCreate}
                disabled={creating || !name.trim()}
                style={[
                  styles.createBtn,
                  {
                    backgroundColor: name.trim() ? colors.accent : colors.tagBg,
                    opacity: name.trim() ? 1 : 0.6,
                  },
                ]}
              >
                <View style={styles.btnInner}>
                  {creating ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <IconPlus size={15} color={name.trim() ? "#fff" : colors.sub} strokeWidth={2.5} />
                  )}
                  <Text
                    style={[
                      styles.btnText,
                      { color: name.trim() ? "#fff" : colors.sub },
                    ]}
                  >
                    {creating ? "Génération..." : "Créer"}
                  </Text>
                </View>
              </CardPressable>
            </View>
          </View>
        ) : null}

        {error ? <Text style={[styles.errorText, { color: "#ff4757" }]}>{error}</Text> : null}

        {/* 3. Liste des clés existantes */}
        <View style={styles.listHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.txt }]}>Mes clés</Text>
          {isAuthed && (
            <Pressable onPress={load} style={{ padding: 4 }}>
              <Text style={{ fontSize: 12, color: colors.accent, fontWeight: "600" }}>Actualiser</Text>
            </Pressable>
          )}
        </View>

        {!isAuthed ? (
          <View style={[styles.emptyBox, { backgroundColor: colors.page, borderColor: colors.tagBg }]}>
            <IconLogin size={28} color={colors.sub} strokeWidth={1.5} />
            <Text style={[styles.emptyTitle, { color: colors.txt }]}>
              Connexion requise
            </Text>
            <Text style={[styles.emptySub, { color: colors.sub }]}>
              Connectez-vous avec votre compte officiel pour lister, générer ou révoquer vos clés API enregistrées.
            </Text>
            <CardPressable
              radius={10}
              onPress={() => setIsSignInOpen(true)}
              style={[styles.signInBtn, { backgroundColor: colors.accent }]}
            >
              <Text style={styles.signInBtnText}>Se connecter au compte</Text>
            </CardPressable>
          </View>
        ) : loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={[styles.loadingText, { color: colors.sub }]}>Chargement de vos clés...</Text>
          </View>
        ) : keys.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: colors.page, borderColor: colors.tagBg }]}>
            <IconKey size={26} color={colors.sub} strokeWidth={1.5} style={{ opacity: 0.6 }} />
            <Text style={[styles.emptyTitle, { color: colors.txt }]}>Aucune clé API créée</Text>
            <Text style={[styles.emptySub, { color: colors.sub }]}>
              Utilisez le formulaire ci-dessus pour générer votre première clé API nHentai.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>{keys.map(renderKeyCard)}</View>
        )}
      </ScrollView>

      {/* Modal après création réussie */}
      <Modal
        visible={!!createdKey}
        transparent
        animationType="fade"
        onRequestClose={() => setCreatedKey(null)}
      >
        <View style={styles.backdrop}>
          <View style={[styles.keyModal, { backgroundColor: colors.page, borderColor: colors.tagBg }]}>
            <IconCircleCheck size={32} color="#22c55e" strokeWidth={2} />
            <Text style={[styles.keyModalTitle, { color: colors.txt }]}>Clé API Générée !</Text>
            <Text style={[styles.keyModalWarn, { color: colors.sub }]}>
              Copiez cette clé maintenant ou appliquez-la directement dans l'application :
            </Text>

            <Text
              selectable
              style={[
                styles.keyValue,
                { backgroundColor: colors.tagBg, color: colors.accent, borderColor: colors.accent },
              ]}
            >
              {createdKey}
            </Text>

            <View style={{ width: "100%", gap: 8, marginTop: 14 }}>
              {/* Bouton 1 : Utiliser directement dans l'app */}
              <Pressable
                onPress={async () => {
                  if (createdKey) {
                    await handleApplyApiKey(createdKey);
                    setCreatedKey(null);
                  }
                }}
                style={[styles.keyModalBtn, { backgroundColor: colors.accent }]}
              >
                <IconBolt size={16} color="#fff" strokeWidth={2.5} />
                <Text style={styles.keyModalBtnText}>⚡ Utiliser directement dans l'app</Text>
              </Pressable>

              {/* Bouton 2 : Copier */}
              <Pressable
                onPress={() => createdKey && handleCopyKey(createdKey)}
                style={[styles.keyModalBtnSecondary, { backgroundColor: colors.tagBg }]}
              >
                {copiedKey ? (
                  <IconCheck size={16} color="#22c55e" strokeWidth={2.5} />
                ) : (
                  <IconCopy size={16} color={colors.txt} strokeWidth={2} />
                )}
                <Text style={[styles.keyModalBtnTextSecondary, { color: colors.txt }]}>
                  {copiedKey ? "Copié dans le presse-papier !" : "Copier la clé"}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setCreatedKey(null)}
                style={{ paddingVertical: 8, alignItems: "center" }}
              >
                <Text style={{ fontSize: 12, color: colors.sub }}>Fermer</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <SignInModal
        visible={isSignInOpen}
        onClose={() => setIsSignInOpen(false)}
        onSuccess={() => {
          setIsSignInOpen(false);
          load();
        }}
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
    paddingVertical: 14,
    gap: 14,
    paddingBottom: 40,
  },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusBannerTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  statusBannerSub: {
    fontSize: 11,
    marginTop: 2,
  },
  card: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  sectionSub: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  input: {
    height: 40,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  iconButtonSmall: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  actionBtn: {
    height: 38,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
  },
  createBtn: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  btnInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  btnText: {
    fontSize: 12.5,
    fontWeight: "700",
  },
  listHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },
  loadingBox: {
    paddingVertical: 30,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
  },
  emptyBox: {
    padding: 20,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  emptySub: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 17,
  },
  signInBtn: {
    marginTop: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
  },
  signInBtnText: {
    color: "#fff",
    fontSize: 12.5,
    fontWeight: "700",
  },
  keyCard: {
    padding: 12,
    borderRadius: 12,
  },
  keyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  keyIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  keyName: {
    fontSize: 13.5,
    fontWeight: "700",
  },
  keyMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  activeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  activeBadgeText: {
    color: "#fff",
    fontSize: 9.5,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  keyModal: {
    width: "100%",
    maxWidth: 380,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    gap: 8,
  },
  keyModalTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  keyModalWarn: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 16,
  },
  keyValue: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 13,
    fontWeight: "700",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 8,
    width: "100%",
    textAlign: "center",
  },
  keyModalBtn: {
    flexDirection: "row",
    height: 42,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  keyModalBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
  keyModalBtnSecondary: {
    flexDirection: "row",
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  keyModalBtnTextSecondary: {
    fontWeight: "700",
    fontSize: 12.5,
  },
});
