import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from "react-native";
import {
  IconBook2,
  IconUser,
  IconDownload,
  IconBookmark,
  IconHeart,
  IconClock,
  IconTag,
  IconSparkles,
  IconCloudDownload,
  IconKey,
  IconSettings,
  IconLock,
  IconChevronRight,
  IconArrowsShuffle,
  IconBrandDiscord,
  IconUserCheck,
  IconLogin,
} from "@tabler/icons-react-native";
import { usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useTheme } from "@/lib/ThemeContext";
import { getRandomGallery } from "@/lib/api/nhentai";
import { SignInModal } from "@/components/modals/SignInModal";
import { useAccount } from "@/lib/accountStore";
import { resolveAvatarUrl } from "@/app/profile";

interface SideMenuProps {
  closeDrawer: () => void;
}

export function SideMenu({ closeDrawer }: SideMenuProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { session, isLoggedIn } = useAccount();
  const [randomLoading, setRandomLoading] = useState(false);
  const [isSignInOpen, setIsSignInOpen] = useState(false);

  const menuItems = [
    {
      label: isLoggedIn ? (session.username || "Profil") : "Profil",
      icon: IconUser,
      route: "/profile",
      hasArrow: true,
      onPress: () => {
        if (!isLoggedIn) {
          setIsSignInOpen(true);
        } else {
          handleNavigate("/profile");
        }
      },
    },
    { label: "Téléchargements", icon: IconDownload, route: "/downloaded", hasArrow: true },
    { label: "Favoris locaux", icon: IconBookmark, route: "/favorites", hasArrow: true },
    {
      label: isLoggedIn ? `Favoris Cloud (${session.cloudFavoritesCount || 0})` : "Favoris Cloud",
      icon: IconHeart,
      route: "/favorites",
      isLocked: !isLoggedIn,
      onPress: () => {
        if (!isLoggedIn) {
          setIsSignInOpen(true);
        } else {
          handleNavigate("/favorites");
        }
      },
    },
    { label: "Historique", icon: IconClock, route: "/history", hasArrow: true },
    { label: "Tags & Packs", icon: IconTag, route: "/tags", hasArrow: true },
    { label: "Recommandations", icon: IconSparkles, route: "/recommendations", hasArrow: true },
    { label: "Téléchargement groupé", icon: IconCloudDownload, route: "/batch", hasArrow: true },
    { label: "Clés API", icon: IconKey, route: "/api-keys", hasArrow: true },
    { label: "Paramètres", icon: IconSettings, route: "/settings", hasArrow: true },
  ];

  const handleNavigate = (route: string) => {
    closeDrawer();
    router.push(route as any);
  };

  const handleRandom = async () => {
    setRandomLoading(true);
    try {
      const g = await getRandomGallery();
      closeDrawer();
      if (g && g.id) {
        router.push({ pathname: "/book/[id]", params: { id: String(g.id) } });
      }
    } catch (e) {
      console.warn("Random failed:", e);
    } finally {
      setRandomLoading(false);
    }
  };

  const handleDiscord = () => {
    try {
      Linking.openURL("https://discord.gg");
    } catch {}
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.menuBg,
          paddingTop: Math.max(insets.top, 24),
          paddingBottom: Math.max(insets.bottom, 20),
        },
      ]}
    >
      {/* Brand Header */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View
            style={[
              styles.brandIcon,
              { backgroundColor: colors.page, borderColor: colors.tagBg, borderWidth: 1 },
            ]}
          >
            <IconBook2 size={20} color={colors.accent} strokeWidth={1.8} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={styles.brandTitle}>nHentai</Text>
              <View style={styles.networkDiodeWrap}>
                <View style={styles.networkDiode} />
                <Text style={styles.networkDiodeText}>Photon</Text>
              </View>
            </View>
            <Text style={styles.brandSubtitle}>Archive & Reader</Text>
          </View>
        </View>
      </View>

      {/* Nav Menu Items */}
      <ScrollView style={styles.menuScroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionHeader}>LIBRARY</Text>

        <View style={styles.menuList}>
          {menuItems.map((item) => {
            const isActive = pathname?.startsWith(item.route);
            const tint = isActive ? colors.accent : colors.sub;
            const IconComp = item.icon;

            return (
              <TouchableOpacity
                key={item.label}
                activeOpacity={0.7}
                onPress={() => (item.onPress ? item.onPress() : handleNavigate(item.route))}
                style={[
                  styles.menuItem,
                  {
                    backgroundColor: isActive ? colors.accent + "26" : "transparent",
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={item.label}
              >
                <View style={styles.menuItemContent}>
                  <IconComp
                    size={18}
                    color={tint}
                    strokeWidth={isActive ? 2 : 1.7}
                    style={styles.menuIcon}
                  />
                  <Text
                    style={[
                      styles.menuText,
                      {
                        color: tint,
                        fontWeight: isActive ? "700" : "500",
                      },
                    ]}
                  >
                    {item.label}
                  </Text>

                  {item.isLocked ? (
                    <IconLock size={14} color="#6b7280" strokeWidth={1.8} style={{ flexShrink: 0 }} />
                  ) : item.hasArrow ? (
                    <IconChevronRight size={16} color="#6b7280" strokeWidth={2} style={{ flexShrink: 0 }} />
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* I'M FEELING LUCKY Button */}
        <View style={styles.luckySection}>
          <TouchableOpacity
            activeOpacity={0.82}
            onPress={handleRandom}
            disabled={randomLoading}
            style={[styles.luckyButton, { backgroundColor: colors.accent }]}
            accessibilityRole="button"
            accessibilityLabel="Ouvrir une galerie au hasard"
          >
            <View style={styles.luckyButtonContent}>
              {randomLoading ? (
                <ActivityIndicator size="small" color={colors.bg} />
              ) : (
                <IconArrowsShuffle size={17} color={colors.bg} strokeWidth={2.2} />
              )}
              <Text style={styles.luckyText}>I'M FEELING LUCKY</Text>
              <Text style={styles.sparkleFloral}>✧ ✦</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Discord Join Card */}
        <TouchableOpacity
          activeOpacity={0.82}
          onPress={handleDiscord}
          style={[styles.discordCard, { backgroundColor: colors.page, borderColor: colors.tagBg }]}
          accessibilityRole="button"
          accessibilityLabel="Rejoindre le serveur Discord"
        >
          <View style={styles.discordContent}>
            <IconBrandDiscord size={20} color={colors.accent} strokeWidth={1.8} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={styles.discordTitle}>Join Discord</Text>
                <Text style={[styles.discordSparkles, { color: colors.accent }]}>✧ ✦ ⋆</Text>
              </View>
              <Text style={styles.discordSub}>
                Get early builds, ask questions, share ideas
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </ScrollView>

      {/* Sign in / User Profile footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            if (isLoggedIn) {
              handleNavigate("/profile");
            } else {
              setIsSignInOpen(true);
            }
          }}
          style={[styles.signInBtn, { backgroundColor: colors.page, borderColor: colors.tagBg }]}
          accessibilityRole="button"
          accessibilityLabel={isLoggedIn ? "Ouvrir mon profil" : "Se connecter"}
        >
          <View style={styles.signInContent}>
            {isLoggedIn ? (
              session.profile?.avatar_url ? (
                <Image
                  source={{ uri: resolveAvatarUrl(session.profile.avatar_url, session.username) }}
                  style={{ width: 22, height: 22, borderRadius: 11 }}
                  contentFit="cover"
                />
              ) : (
                <IconUserCheck size={18} color="#52c41a" strokeWidth={2} />
              )
            ) : (
              <IconLogin size={18} color={colors.accent} strokeWidth={2} />
            )}
            <Text style={styles.signInText}>
              {isLoggedIn ? (session.username || "Mon Profil") : "Sign in"}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Sign In Modal */}
      <SignInModal visible={isSignInOpen} onClose={() => setIsSignInOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  header: {
    paddingVertical: 14,
    marginBottom: 6,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  brandIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  brandTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#f3f4f6",
    letterSpacing: 0.3,
  },
  networkDiodeWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(82, 196, 26, 0.12)",
    borderColor: "rgba(82, 196, 26, 0.25)",
    borderWidth: 0.8,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  networkDiode: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#52c41a",
  },
  networkDiodeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#52c41a",
  },
  brandSubtitle: {
    fontSize: 11,
    color: "#9ca3af",
    marginTop: 1,
  },
  sectionHeader: {
    fontSize: 10,
    fontWeight: "800",
    color: "#6b7280",
    letterSpacing: 1,
    marginTop: 10,
    marginBottom: 8,
    paddingHorizontal: 6,
  },
  menuScroll: {
    flex: 1,
  },
  menuList: {
    gap: 2,
  },
  menuItem: {
    borderRadius: 12,
    marginVertical: 1,
  },
  menuItemContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  menuIcon: {
    marginRight: 14,
    flexShrink: 0,
  },
  menuText: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    fontSize: 13.5,
  },
  luckySection: {
    marginTop: 14,
    marginBottom: 8,
  },
  luckyButton: {
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  luckyButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  luckyText: {
    color: "#1c191a",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  sparkleFloral: {
    color: "#1c191a",
    fontSize: 12,
    fontWeight: "800",
  },
  discordCard: {
    borderRadius: 12,
    padding: 12,
    marginTop: 6,
    marginBottom: 16,
    borderWidth: 1,
  },
  discordContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  discordTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#f3f4f6",
  },
  discordSparkles: {
    fontSize: 10,
    letterSpacing: 1,
  },
  discordSub: {
    fontSize: 10.5,
    color: "#9ca3af",
    marginTop: 1,
  },
  footer: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#20202e",
  },
  signInBtn: {
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  signInContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  signInText: {
    color: "#f3f4f6",
    fontSize: 13,
    fontWeight: "700",
  },
});

export default SideMenu;
