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
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/ThemeContext";
import { CardPressable } from "@/components/ui/CardPressable";
import { getRandomGallery } from "@/lib/api/nhentai";
import { SignInModal } from "@/components/modals/SignInModal";
import { useAccount } from "@/lib/accountStore";

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
    { label: "Downloaded", icon: "download", route: "/downloaded", hasArrow: true },
    { label: "Bookmarks", icon: "bookmark", route: "/favorites", hasArrow: true },
    {
      label: isLoggedIn ? `Online favorites (${session.cloudFavoritesCount || 0})` : "Online favorites",
      icon: "heart",
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
    { label: "History", icon: "clock", route: "/history", hasArrow: true },
    { label: "Characters", icon: "box", route: "/tags", hasArrow: true },
    { label: "Recommendations", icon: "star", route: "/recommendations", hasArrow: true },
    { label: "Batch Downloader", icon: "download-cloud", route: "/batch", hasArrow: true },
    { label: "Settings", icon: "settings", route: "/settings", hasArrow: true },
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
          backgroundColor: "#13131c",
          paddingTop: Math.max(insets.top, 24),
          paddingBottom: Math.max(insets.bottom, 20),
        },
      ]}
    >
      {/* Brand Header (Matching NHApp) */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={[styles.brandIcon, { backgroundColor: "#202030" }]}>
            <Feather name="book-open" size={22} color={colors.accent} />
          </View>
          <View>
            <Text style={styles.brandTitle}>NHApp</Text>
            <Text style={styles.brandSubtitle}>Unofficial</Text>
          </View>
        </View>
      </View>

      {/* Nav Menu Items */}
      <ScrollView style={styles.menuScroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionHeader}>LIBRARY</Text>

        <View style={styles.menuList}>
          {menuItems.map((item) => {
            const isActive = pathname?.startsWith(item.route);
            const tint = isActive ? "#ffffff" : "#c4c6cf";

            return (
              <TouchableOpacity
                key={item.label}
                activeOpacity={0.7}
                onPress={() => (item.onPress ? item.onPress() : handleNavigate(item.route))}
                style={[
                  styles.menuItem,
                  {
                    backgroundColor: isActive ? "#222232" : "transparent",
                  },
                ]}
              >
                <View style={styles.menuItemContent}>
                  <Feather
                    name={item.icon as any}
                    size={18}
                    color={tint}
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
                    <Feather name="lock" size={14} color="#6b7280" />
                  ) : item.hasArrow ? (
                    <Feather name="chevron-right" size={16} color="#6b7280" />
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* I'M FEELING LUCKY Button with Floral Sparkles Decoration */}
        <View style={styles.luckySection}>
          <TouchableOpacity
            activeOpacity={0.82}
            onPress={handleRandom}
            disabled={randomLoading}
            style={[styles.luckyButton, { backgroundColor: "#c5878d" }]}
          >
            <View style={styles.luckyButtonContent}>
              {randomLoading ? (
                <ActivityIndicator size="small" color="#1c191a" />
              ) : (
                <Feather name="shuffle" size={17} color="#1c191a" />
              )}
              <Text style={styles.luckyText}>I'M FEELING LUCKY</Text>
              <Text style={styles.sparkleFloral}>✧ ✦</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Discord Join Card with Celestial Sparkles */}
        <TouchableOpacity
          activeOpacity={0.82}
          onPress={handleDiscord}
          style={styles.discordCard}
        >
          <View style={styles.discordContent}>
            <Ionicons name="chatbubble-outline" size={20} color="#c5878d" />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={styles.discordTitle}>Join Discord</Text>
                <Text style={styles.discordSparkles}>✧ ✦ ⋆</Text>
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
          onPress={() => setIsSignInOpen(true)}
          style={styles.signInBtn}
        >
          <View style={styles.signInContent}>
            <Feather
              name={isLoggedIn ? "user-check" : "log-in"}
              size={18}
              color={isLoggedIn ? "#52c41a" : "#c5878d"}
            />
            <Text style={styles.signInText}>
              {isLoggedIn ? (session.username || "Compte Cloud") : "Sign in"}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Sign In / Cloud Sync Modal */}
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
    paddingVertical: 11,
    paddingHorizontal: 10,
  },
  menuIcon: {
    marginRight: 12,
  },
  menuText: {
    fontSize: 13.5,
    flex: 1,
  },
  luckySection: {
    marginTop: 20,
    marginBottom: 12,
  },
  luckyButton: {
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  luckyButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  luckyText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#1c191a",
    letterSpacing: 0.5,
  },
  sparkleFloral: {
    fontSize: 12,
    color: "#1c191a",
    fontWeight: "800",
    marginLeft: 2,
  },
  discordCard: {
    backgroundColor: "#1a1a26",
    borderColor: "#28283a",
    borderWidth: 1,
    padding: 12,
    borderRadius: 14,
    marginBottom: 12,
  },
  discordContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  discordTitle: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#f3f4f6",
  },
  discordSparkles: {
    fontSize: 10.5,
    color: "#c5878d",
    letterSpacing: 1,
  },
  discordSub: {
    fontSize: 10,
    color: "#9ca3af",
    marginTop: 2,
    lineHeight: 13,
  },
  footer: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#20202e",
  },
  signInBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  signInContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  signInText: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#f3f4f6",
  },
});

export default SideMenu;
