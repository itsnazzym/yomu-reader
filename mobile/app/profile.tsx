import React, { useCallback, useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  Modal,
} from "react-native";
import {
  IconArrowLeft,
  IconRotateClockwise,
  IconUser,
  IconLogin,
  IconCheck,
  IconMail,
  IconHeart,
  IconChevronRight,
  IconPhoto,
  IconMessageCircle,
  IconLock,
  IconChevronUp,
  IconChevronDown,
  IconRefresh,
  IconKey,
  IconLogout,
  IconX,
} from "@tabler/icons-react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useTheme } from "@/lib/ThemeContext";
import { useAccount, UserComment } from "@/lib/accountStore";
import { useFavorites } from "@/lib/favoritesStore";
import { CardPressable } from "@/components/ui/CardPressable";
import { IconBtn } from "@/components/ui/IconBtn";
import { SignInModal } from "@/components/modals/SignInModal";
import { AvatarCropModal, AvatarCropResult } from "@/components/modals/AvatarCropModal";
import SmartImage from "@/components/SmartImage";
import { lightTap } from "@/lib/haptics";

function generatedAvatarUrl(username?: string): string {
  const cleanName = encodeURIComponent(username || "User");
  return `https://ui-avatars.com/api/?name=${cleanName}&background=c5878d&color=fff&bold=true&size=256`;
}

function uniqueUrls(urls: string[]): string[] {
  return [...new Set(urls.filter(Boolean))];
}

export function resolveAvatarCandidates(url?: string, username?: string): string[] {
  if (!url || url.trim() === "") {
    return [generatedAvatarUrl(username)];
  }

  const clean = url.trim();

  // Local storage, content URI or data URI (persisted avatar)
  if (
    clean.startsWith("file:") ||
    clean.startsWith("content:") ||
    clean.startsWith("data:") ||
    clean.startsWith("blob:")
  ) {
    return [clean];
  }

  if (clean.startsWith("//")) {
    return resolveAvatarCandidates(`https:${clean}`, username);
  }

  if (/^https?:\/\//i.test(clean)) {
    try {
      const parsed = new URL(clean);
      const host = parsed.hostname.toLowerCase();

      if (host === "imgur.com" || host.endsWith(".imgur.com")) {
        const segments = parsed.pathname.split("/").filter(Boolean);
        const fileName = segments[segments.length - 1] || "";
        const isAlbum = segments[0] === "a" || segments[0] === "gallery";
        const isImage = /\.(?:jpe?g|png|gif|webp|gifv)$/i.test(fileName);

        if (!isAlbum && fileName) {
          const normalizedName = fileName.replace(/\.gifv$/i, ".gif");
          const urlSuffix = `${parsed.search}${parsed.hash}`;
          const directUrl = `https://i.imgur.com/${normalizedName}${urlSuffix}`;
          if (isImage) return uniqueUrls([directUrl, clean]);

          return uniqueUrls([
            `https://i.imgur.com/${normalizedName}.gif${urlSuffix}`,
            `https://i.imgur.com/${normalizedName}.png${urlSuffix}`,
            `https://i.imgur.com/${normalizedName}.jpg${urlSuffix}`,
            clean,
          ]);
        }
      }

      if (host === "nhentai.net") {
        return [`https://i0.wp.com/nhentai.net/${parsed.pathname.replace(/^\/+/, "")}${parsed.search}`];
      }

      return [clean];
    } catch {
      return [clean];
    }
  }

  const path = clean.startsWith("/") ? clean.slice(1) : clean;
  return [`https://i0.wp.com/nhentai.net/${path}`];
}

export function resolveAvatarUrl(url?: string, username?: string): string {
  return resolveAvatarCandidates(url, username)[0] || generatedAvatarUrl(username);
}

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const {
    session,
    profile,
    comments,
    isLoggedIn,
    fetchUserProfile,
    changeUserPassword,
    updateAvatar,
    syncFavorites,
    logout,
  } = useAccount();
  const { favorites } = useFavorites();

  const [refreshing, setRefreshing] = useState(false);
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [isAvatarCropOpen, setIsAvatarCropOpen] = useState(false);
  const [isAvatarOptionsOpen, setIsAvatarOptionsOpen] = useState(false);
  const [avatarCandidateIndex, setAvatarCandidateIndex] = useState(0);

  // Password change form state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [syncingFavs, setSyncingFavs] = useState(false);

  const loadData = useCallback(async () => {
    if (isLoggedIn) {
      setRefreshing(true);
      try {
        await fetchUserProfile();
      } finally {
        setRefreshing(false);
      }
    }
  }, [isLoggedIn, fetchUserProfile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle password change
  const handleChangePassword = async () => {
    const cur = currentPassword.trim();
    const next = newPassword.trim();
    const conf = confirmPassword.trim();

    if (!cur || !next || !conf) {
      Alert.alert("Champs requis", "Veuillez remplir tous les champs du mot de passe.");
      return;
    }
    if (next !== conf) {
      Alert.alert("Erreur", "Le nouveau mot de passe et sa confirmation ne correspondent pas.");
      return;
    }
    if (next.length < 6) {
      Alert.alert("Erreur", "Le mot de passe doit comporter au moins 6 caractères.");
      return;
    }

    setChangingPassword(true);
    try {
      const res = await changeUserPassword(cur, next);
      if (res.success) {
        Alert.alert("Succès", "Votre mot de passe a été modifié avec succès sur nHentai.net !");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setShowPasswordForm(false);
      } else {
        Alert.alert("Échec", res.error || "Impossible de changer le mot de passe.");
      }
    } catch (err: unknown) {
      Alert.alert(
        "Erreur",
        err instanceof Error ? err.message : "Une erreur est survenue."
      );
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSaveCroppedAvatar = async (result: AvatarCropResult) => {
    try {
      const res = await updateAvatar(result.uri);
      if (res.success) {
        Alert.alert("Avatar mis à jour ✧✦", "Votre photo de profil a été recadrée et mise à jour avec succès.");
        setIsAvatarOptionsOpen(false);
        await loadData();
      } else {
        Alert.alert("Échec", res.error || "Impossible de mettre à jour l'avatar.");
      }
    } catch (err: unknown) {
      console.warn("Save avatar error:", err);
      Alert.alert("Erreur", "Une erreur est survenue lors de l'enregistrement de l'avatar.");
    }
  };

  const handleChoosePreset = async (presetUrl: string) => {
    try {
      const res = await updateAvatar(presetUrl);
      if (res.success) {
        Alert.alert("Avatar mis à jour ✧✦", "Le style d'avatar sélectionné a été appliqué.");
        setIsAvatarOptionsOpen(false);
        await loadData();
      } else {
        Alert.alert("Échec", res.error || "Impossible de mettre à jour l'avatar.");
      }
    } catch (err: unknown) {
      console.warn("Preset avatar error:", err);
    }
  };

  const handleResetAvatar = async () => {
    try {
      const res = await updateAvatar("");
      if (res.success) {
        Alert.alert("Avatar réinitialisé", "La photo de profil par défaut a été rétablie.");
        setIsAvatarOptionsOpen(false);
        await loadData();
      }
    } catch (err: unknown) {
      console.warn("Reset avatar error:", err);
    }
  };

  const handleManualSync = async () => {
    setSyncingFavs(true);
    try {
      const res = await syncFavorites();
      if (res.success) {
        Alert.alert("Cloud Synchronisé", `${res.count} favoris mis à jour.`);
      } else {
        Alert.alert("Erreur", res.error || "Échec de synchronisation.");
      }
    } finally {
      setSyncingFavs(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Déconnexion", "Êtes-vous sûr de vouloir vous déconnecter ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Déconnexion",
        style: "destructive",
        onPress: () => {
          logout();
          router.replace("/");
        },
      },
    ]);
  };

  const recentFavorites = favorites.slice(0, 15);
  const username = profile?.username || session.username || "Membre nHentai";
  const email = profile?.email || "Non renseigné / Privé";
  const avatarCandidates = resolveAvatarCandidates(profile?.avatar_url, username);
  const displayAvatarUrl = avatarCandidates[avatarCandidateIndex];
  const userComments: UserComment[] = comments || [];

  useEffect(() => {
    setAvatarCandidateIndex(0);
  }, [profile?.avatar_url, username]);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.bg, paddingTop: Math.max(insets.top, 12) },
      ]}
    >
      {/* Top Header */}
      <View style={[styles.header, { borderBottomColor: colors.tagBg }]}>
        <IconBtn onPress={() => router.back()} size={36} style={styles.backBtn}>
          <IconArrowLeft size={18} color={colors.txt} stroke={2} />
        </IconBtn>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.txt }]}>Profil</Text>
          <Text style={[styles.headerSub, { color: colors.sub }]}>
            {isLoggedIn ? "Compte officiel nHentai" : "Non connecté"}
          </Text>
        </View>
        {isLoggedIn && (
          <IconBtn onPress={loadData} size={36} disabled={refreshing}>
            {refreshing ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <IconRotateClockwise size={16} color={colors.txt} stroke={2} />
            )}
          </IconBtn>
        )}
      </View>

      {!isLoggedIn ? (
        <View style={styles.notLoggedInCenter}>
          <View style={[styles.emptyAvatarBox, { backgroundColor: colors.tagBg }]}>
            <IconUser size={48} color={colors.sub} stroke={1.5} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.txt }]}>
            Connectez votre compte
          </Text>
          <Text style={[styles.emptySub, { color: colors.sub }]}>
            Accédez à vos favoris synchronisés, consultez vos commentaires et gérez votre compte.
          </Text>
          <CardPressable
            radius={14}
            onPress={() => setIsSignInOpen(true)}
            style={[styles.connectBtn, { backgroundColor: colors.accent }]}
          >
            <View style={styles.connectBtnInner}>
              <IconLogin size={18} color="#fff" stroke={2} />
              <Text style={styles.connectBtnText}>Se connecter</Text>
            </View>
          </CardPressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Profile Card */}
          <View style={[styles.heroCard, { backgroundColor: colors.page, borderColor: colors.tagBg }]}>
            <View style={styles.heroRow}>
              <Pressable
                onPress={() => {
                  lightTap();
                  setIsAvatarOptionsOpen(true);
                }}
                style={styles.avatarWrap}
              >
                {displayAvatarUrl ? (
                  <Image
                    source={{ uri: displayAvatarUrl }}
                    style={styles.avatarImg}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={150}
                    onError={() => setAvatarCandidateIndex((index) => index + 1)}
                  />
                ) : (
                  <View style={styles.avatarFallback}>
                    <IconUser size={28} color="#9ca3af" stroke={1.6} />
                  </View>
                )}
                <View style={[styles.avatarEditBadge, { backgroundColor: colors.accent }]}>
                  <IconPhoto size={11} color="#fff" stroke={2.5} />
                </View>
              </Pressable>

              <View style={{ flex: 1, gap: 3 }}>
                <View style={styles.usernameRow}>
                  <Text style={[styles.usernameText, { color: colors.txt }]} numberOfLines={1}>
                    {username}
                  </Text>
                  <View style={styles.badgeOfficial}>
                    <IconCheck size={10} color="#52c41a" stroke={3} />
                    <Text style={styles.badgeOfficialText}>Officiel</Text>
                  </View>
                </View>

                <View style={styles.emailRow}>
                  <IconMail size={12} color={colors.sub} stroke={1.8} />
                  <Text style={[styles.emailText, { color: colors.sub }]} numberOfLines={1}>
                    {email}
                  </Text>
                </View>

                <Text style={[styles.sessionType, { color: colors.accent }]}>
                  Mode : {session.credentialType === "apiKey" ? "Clé API" : "Session API v2"}
                </Text>
              </View>
            </View>

            {/* Stats Row */}
            <View style={[styles.statsRow, { borderTopColor: colors.tagBg }]}>
              <View style={styles.statCol}>
                <Text style={[styles.statVal, { color: colors.txt }]}>
                  {favorites.length}
                </Text>
                <Text style={[styles.statLabel, { color: colors.sub }]}>Favoris</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.tagBg }]} />
              <View style={styles.statCol}>
                <Text style={[styles.statVal, { color: colors.txt }]}>
                  {userComments.length}
                </Text>
                <Text style={[styles.statLabel, { color: colors.sub }]}>Commentaires</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.tagBg }]} />
              <View style={styles.statCol}>
                <Text style={[styles.statVal, { color: "#52c41a" }]}>Connecté</Text>
                <Text style={[styles.statLabel, { color: colors.sub }]}>Statut</Text>
              </View>
            </View>
          </View>

          {/* Section 1: Favoris Récents (Slider Horizontal 15) */}
          <View style={styles.sectionWrap}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <IconHeart size={16} color="#ff4757" stroke={2} fill="#ff4757" />
                <Text style={[styles.sectionTitle, { color: colors.txt }]}>
                  Favoris récents
                </Text>
              </View>
              {favorites.length > 0 && (
                <Pressable
                  onPress={() => router.push("/favorites")}
                  style={styles.viewAllBtn}
                >
                  <Text style={[styles.viewAllText, { color: colors.accent }]}>Voir tout</Text>
                  <IconChevronRight size={14} color={colors.accent} stroke={2} />
                </Pressable>
              )}
            </View>

            {recentFavorites.length === 0 ? (
              <View style={[styles.emptyFavCard, { backgroundColor: colors.page, borderColor: colors.tagBg }]}>
                <Text style={[styles.emptyFavText, { color: colors.sub }]}>
                  Aucun favori synchronisé pour le moment.
                </Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalScroll}
              >
                {recentFavorites.map((fav) => {
                  const title = fav.title?.pretty || fav.title?.english || `Gallery #${fav.id}`;
                  const cover = fav.images?.cover?.url || fav.images?.thumbnail?.url || "";

                  return (
                    <CardPressable
                      key={fav.id}
                      radius={12}
                      onPress={() => router.push({ pathname: "/book/[id]", params: { id: String(fav.id) } })}
                      style={styles.favCard}
                    >
                      <View style={styles.favCoverBox}>
                        {cover ? (
                          <SmartImage uri={cover} style={styles.favCoverImg} contentFit="cover" />
                        ) : (
                          <View style={[styles.favCoverPlaceholder, { backgroundColor: colors.tagBg }]}>
                            <IconPhoto size={20} color={colors.sub} stroke={1.8} />
                          </View>
                        )}
                        <View style={styles.favIdBadge}>
                          <Text style={styles.favIdText}>#{fav.id}</Text>
                        </View>
                      </View>
                      <Text style={[styles.favTitle, { color: colors.txt }]} numberOfLines={2}>
                        {title}
                      </Text>
                    </CardPressable>
                  );
                })}

                {/* Card "Voir tout" at the end of slider */}
                {favorites.length > 15 && (
                  <CardPressable
                    radius={12}
                    onPress={() => router.push("/favorites")}
                    style={[styles.favCard, styles.moreCard, { backgroundColor: colors.page, borderColor: colors.tagBg }]}
                  >
                    <IconHeart size={24} color={colors.accent} stroke={1.8} />
                    <Text style={[styles.moreText, { color: colors.accent }]}>
                      +{favorites.length - 15} autres
                    </Text>
                  </CardPressable>
                )}
              </ScrollView>
            )}
          </View>

          {/* Section 2: Commentaires Postés */}
          <View style={styles.sectionWrap}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <IconMessageCircle size={16} color={colors.accent} stroke={2} />
                <Text style={[styles.sectionTitle, { color: colors.txt }]}>
                  Mes commentaires ({userComments.length})
                </Text>
              </View>
            </View>

            {userComments.length === 0 ? (
              <View style={[styles.emptyCommentBox, { backgroundColor: colors.page, borderColor: colors.tagBg }]}>
                <Text style={[styles.emptyCommentText, { color: colors.sub }]}>
                  Vous n'avez posté aucun commentaire pour le moment.
                </Text>
              </View>
            ) : (
              <View style={styles.commentsList}>
                {userComments.map((comment) => (
                  <CardPressable
                    key={comment.id}
                    radius={12}
                    onPress={() =>
                      router.push({
                        pathname: "/book/[id]",
                        params: { id: String(comment.gallery_id) },
                      })
                    }
                    style={[styles.commentCard, { backgroundColor: colors.page, borderColor: colors.tagBg }]}
                  >
                    <View style={styles.commentHeader}>
                      <Text style={[styles.commentGalleryTitle, { color: colors.txt }]} numberOfLines={1}>
                        {comment.gallery_title}
                      </Text>
                      <Text style={[styles.commentDate, { color: colors.sub }]}>
                        {new Date(comment.post_date * 1000).toLocaleDateString("fr-FR")}
                      </Text>
                    </View>
                    <Text style={[styles.commentBody, { color: colors.sub }]} numberOfLines={3}>
                      {comment.body}
                    </Text>
                  </CardPressable>
                ))}
              </View>
            )}
          </View>

          {/* Section 3: Sécurité & Mot de passe */}
          <View style={styles.sectionWrap}>
            <View style={[styles.securityCard, { backgroundColor: colors.page, borderColor: colors.tagBg }]}>
              <Pressable
                onPress={() => setShowPasswordForm((prev) => !prev)}
                style={styles.securityHeader}
              >
                <View style={styles.securityTitleRow}>
                  <IconLock size={16} color={colors.accent} stroke={2} />
                  <Text style={[styles.sectionTitle, { color: colors.txt }]}>
                    Changer le mot de passe
                  </Text>
                </View>
                {showPasswordForm ? (
                  <IconChevronUp size={16} color={colors.sub} stroke={2} />
                ) : (
                  <IconChevronDown size={16} color={colors.sub} stroke={2} />
                )}
              </Pressable>

              {showPasswordForm && (
                <View style={styles.passwordForm}>
                  <Text style={[styles.formLabel, { color: colors.sub }]}>Mot de passe actuel</Text>
                  <TextInput
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    secureTextEntry
                    placeholder="••••••••"
                    placeholderTextColor="#6b7280"
                    style={[styles.formInput, { backgroundColor: colors.tagBg, color: colors.txt }]}
                  />

                  <Text style={[styles.formLabel, { color: colors.sub, marginTop: 8 }]}>Nouveau mot de passe</Text>
                  <TextInput
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry
                    placeholder="•••••••• (min 6 caractères)"
                    placeholderTextColor="#6b7280"
                    style={[styles.formInput, { backgroundColor: colors.tagBg, color: colors.txt }]}
                  />

                  <Text style={[styles.formLabel, { color: colors.sub, marginTop: 8 }]}>Confirmer le mot de passe</Text>
                  <TextInput
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    placeholder="••••••••"
                    placeholderTextColor="#6b7280"
                    style={[styles.formInput, { backgroundColor: colors.tagBg, color: colors.txt }]}
                  />

                  <CardPressable
                    radius={10}
                    onPress={handleChangePassword}
                    disabled={changingPassword}
                    style={[styles.savePassBtn, { backgroundColor: colors.accent }]}
                  >
                    <View style={styles.savePassBtnInner}>
                      {changingPassword ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <IconCheck size={16} color="#fff" stroke={2.5} />
                      )}
                      <Text style={styles.savePassText}>
                        {changingPassword ? "Mise à jour..." : "Enregistrer le mot de passe"}
                      </Text>
                    </View>
                  </CardPressable>
                </View>
              )}
            </View>
          </View>

          {/* Section 4: Actions du compte */}
          <View style={styles.sectionWrap}>
            <View style={styles.actionsBox}>
              <CardPressable
                radius={12}
                onPress={handleManualSync}
                disabled={syncingFavs}
                style={[styles.actionBtn, { backgroundColor: colors.page, borderColor: colors.tagBg }]}
              >
                <View style={styles.actionBtnInner}>
                  {syncingFavs ? (
                    <ActivityIndicator size="small" color={colors.accent} />
                  ) : (
                    <IconRefresh size={16} color={colors.accent} stroke={2} />
                  )}
                  <Text style={[styles.actionBtnText, { color: colors.txt }]}>
                    Synchroniser les favoris
                  </Text>
                </View>
              </CardPressable>

              <CardPressable
                radius={12}
                onPress={() => router.push("/api-keys")}
                style={[styles.actionBtn, { backgroundColor: colors.page, borderColor: colors.tagBg }]}
              >
                <View style={styles.actionBtnInner}>
                  <IconKey size={16} color="#60a5fa" stroke={2} />
                  <Text style={[styles.actionBtnText, { color: colors.txt }]}>
                    Clés API
                  </Text>
                </View>
              </CardPressable>

              <CardPressable
                radius={12}
                onPress={handleLogout}
                style={[styles.actionBtn, { backgroundColor: "rgba(255, 71, 87, 0.1)", borderColor: "rgba(255, 71, 87, 0.3)" }]}
              >
                <View style={styles.actionBtnInner}>
                  <IconLogout size={16} color="#ff4757" stroke={2} />
                  <Text style={[styles.actionBtnText, { color: "#ff4757" }]}>
                    Déconnexion
                  </Text>
                </View>
              </CardPressable>
            </View>
          </View>
        </ScrollView>
      )}

      {/* Modal Options Avatar */}
      <Modal
        visible={isAvatarOptionsOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsAvatarOptionsOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setIsAvatarOptionsOpen(false)}>
          <Pressable
            style={[styles.modalCard, { backgroundColor: "#14141e", borderColor: "#28283a" }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Photo de profil</Text>
                <Text style={styles.modalSub}>
                  Sélectionnez une image de votre appareil (GIF, PNG, JPG...)
                </Text>
              </View>
              <Pressable onPress={() => setIsAvatarOptionsOpen(false)} hitSlop={6}>
                <IconX size={18} color="#9ca3af" stroke={2} />
              </Pressable>
            </View>

            {/* Main Option: Select from device & crop */}
            <Pressable
              onPress={() => {
                lightTap();
                setIsAvatarOptionsOpen(false);
                setIsAvatarCropOpen(true);
              }}
              style={[styles.chooseStorageBtn, { backgroundColor: colors.accent }]}
            >
              <IconPhoto size={20} color="#fff" stroke={2.2} />
              <View style={{ flex: 1 }}>
                <Text style={styles.chooseStorageTitle}>Choisir depuis l'appareil</Text>
                <Text style={styles.chooseStorageSub}>
                  GIF animé, PNG, JPG, WebP avec recadreur
                </Text>
              </View>
              <IconChevronRight size={18} color="#fff" stroke={2} />
            </Pressable>

            {/* Quick Color Presets */}
            <Text style={styles.presetsTitle}>Ou style d'initiales coloré :</Text>
            <View style={styles.presetsRow}>
              {["#ec4899", "#8b5cf6", "#3b82f6", "#10b981", "#f59e0b"].map((bg) => {
                const presetUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=${bg.replace("#", "")}&color=fff&bold=true&size=256`;
                return (
                  <Pressable
                    key={bg}
                    onPress={() => handleChoosePreset(presetUrl)}
                    style={styles.presetItem}
                  >
                    <Image source={{ uri: presetUrl }} style={styles.presetImg} />
                  </Pressable>
                );
              })}
            </View>

            {/* Reset to Default */}
            {profile?.avatar_url && (
              <Pressable
                onPress={handleResetAvatar}
                style={[styles.resetAvatarBtn, { borderColor: "#2d2d40" }]}
              >
                <IconRefresh size={15} color="#9ca3af" stroke={2} />
                <Text style={styles.resetAvatarText}>Rétablir l'avatar par défaut</Text>
              </Pressable>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Interactive Avatar Crop Modal */}
      <AvatarCropModal
        visible={isAvatarCropOpen}
        username={username}
        onClose={() => setIsAvatarCropOpen(false)}
        onSave={handleSaveCroppedAvatar}
      />

      {/* Sign In Modal if user wants to re-auth */}
      <SignInModal
        visible={isSignInOpen}
        onClose={() => setIsSignInOpen(false)}
        onSuccess={() => {
          setIsSignInOpen(false);
          loadData();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
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
    padding: 16,
    gap: 16,
  },
  notLoggedInCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyAvatarBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  emptySub: {
    fontSize: 12.5,
    textAlign: "center",
    lineHeight: 18,
  },
  connectBtn: {
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 12,
    marginTop: 6,
  },
  connectBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  connectBtnText: {
    color: "#fff",
    fontSize: 13.5,
    fontWeight: "800",
  },
  heroCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatarWrap: {
    position: "relative",
  },
  avatarImg: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#202030",
  },
  avatarFallback: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#202030",
  },
  avatarEditBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#12121a",
  },
  usernameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  usernameText: {
    fontSize: 16,
    fontWeight: "800",
  },
  badgeOfficial: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(82, 196, 26, 0.15)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeOfficialText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#52c41a",
  },
  emailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  emailText: {
    fontSize: 11.5,
  },
  sessionType: {
    fontSize: 10.5,
    fontWeight: "700",
    marginTop: 1,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    borderTopWidth: 1,
    paddingTop: 12,
  },
  statCol: {
    alignItems: "center",
    gap: 2,
  },
  statVal: {
    fontSize: 14,
    fontWeight: "800",
  },
  statLabel: {
    fontSize: 10.5,
  },
  statDivider: {
    width: 1,
    height: 24,
  },
  sectionWrap: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  viewAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: "700",
  },
  horizontalScroll: {
    gap: 10,
  },
  favCard: {
    width: 105,
    gap: 6,
  },
  favCoverBox: {
    width: 105,
    height: 145,
    borderRadius: 10,
    overflow: "hidden",
    position: "relative",
  },
  favCoverImg: {
    width: "100%",
    height: "100%",
  },
  favCoverPlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  favIdBadge: {
    position: "absolute",
    bottom: 5,
    left: 5,
    backgroundColor: "rgba(0,0,0,0.75)",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  favIdText: {
    color: "#fff",
    fontSize: 9.5,
    fontWeight: "800",
  },
  favTitle: {
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 14,
  },
  moreCard: {
    height: 145,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  moreText: {
    fontSize: 11,
    fontWeight: "800",
  },
  emptyFavCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  emptyFavText: {
    fontSize: 12,
    fontStyle: "italic",
  },
  commentsList: {
    gap: 8,
  },
  commentCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 6,
  },
  commentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  commentGalleryTitle: {
    fontSize: 12.5,
    fontWeight: "800",
    flex: 1,
    marginRight: 8,
  },
  commentDate: {
    fontSize: 10.5,
  },
  commentBody: {
    fontSize: 12,
    lineHeight: 16,
  },
  emptyCommentBox: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  emptyCommentText: {
    fontSize: 12,
    fontStyle: "italic",
  },
  securityCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  securityHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  securityTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  passwordForm: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    gap: 6,
  },
  formLabel: {
    fontSize: 11,
    fontWeight: "700",
  },
  formInput: {
    height: 38,
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 12.5,
  },
  savePassBtn: {
    height: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  savePassBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  savePassText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
  },
  actionsBox: {
    gap: 8,
  },
  actionBtn: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  actionBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: "700",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#f3f4f6",
  },
  modalSub: {
    fontSize: 11.5,
    color: "#9ca3af",
    lineHeight: 16,
  },
  avatarInput: {
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 12.5,
  },
  presetsTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9ca3af",
  },
  presetsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  presetItem: {
    padding: 2,
    borderRadius: 20,
  },
  presetImg: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  chooseStorageBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginTop: 4,
  },
  chooseStorageTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#fff",
  },
  chooseStorageSub: {
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.8)",
    marginTop: 1,
  },
  resetAvatarBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 2,
  },
  resetAvatarText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#9ca3af",
  },
});
