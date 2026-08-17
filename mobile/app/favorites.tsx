import React, { useState, useMemo } from "react";
import {
  StyleSheet,
  View,
  Text,
  useWindowDimensions,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/ThemeContext";
import { BookCard } from "@/components/BookCard";
import { CardPressable } from "@/components/ui/CardPressable";
import { useFavorites } from "@/lib/favoritesStore";
import { useAccount } from "@/lib/accountStore";
import { Gallery } from "@/lib/api/types";
import { SignInModal } from "@/components/modals/SignInModal";

export default function FavoritesScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { favorites } = useFavorites();
  const { session, isLoggedIn, syncFavorites } = useAccount();

  const [filterQuery, setFilterQuery] = useState("");
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const numColumns = width >= 600 ? 3 : 2;
  const cardGap = 10;
  const horizontalPadding = 12;
  const cardWidth = Math.floor(
    (width - horizontalPadding * 2 - cardGap * (numColumns - 1)) / numColumns
  );

  const filtered = useMemo(() => {
    if (!filterQuery.trim()) return favorites;
    const q = filterQuery.toLowerCase();
    return favorites.filter(
      (g) =>
        g.title?.pretty?.toLowerCase().includes(q) ||
        g.title?.english?.toLowerCase().includes(q) ||
        String(g.id).includes(q)
    );
  }, [favorites, filterQuery]);

  const handleSyncPress = async () => {
    if (!isLoggedIn) {
      setIsSignInOpen(true);
      return;
    }

    setSyncing(true);
    setSyncMsg("Connexion Cloud...");
    try {
      const res = await syncFavorites((msg) => setSyncMsg(msg));
      if (res.success) {
        Alert.alert("Cloud Synchronisé", `${res.count} favoris mis à jour avec le compte officiel.`);
      } else {
        Alert.alert("Information", res.error || "Synchronisation terminée.");
      }
    } catch (e: any) {
      Alert.alert("Erreur", e?.message || "Échec de synchronisation.");
    } finally {
      setSyncing(false);
      setSyncMsg(null);
    }
  };

  const renderItem = ({ item }: { item: Gallery }) => (
    <View style={{ width: cardWidth }}>
      <BookCard gallery={item} cardWidth={cardWidth} />
    </View>
  );

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: "#12121a",
          paddingTop: Math.max(insets.top, 12),
        },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Favoris & Signets</Text>
            <Text style={styles.headerSub}>
              {favorites.length} manga(s) enregistré(s)
            </Text>
          </View>

          {/* Cloud Sync Button */}
          <CardPressable
            radius={12}
            onPress={handleSyncPress}
            disabled={syncing}
            style={[
              styles.syncBtn,
              { backgroundColor: isLoggedIn ? "rgba(197, 135, 141, 0.2)" : colors.accent },
            ]}
          >
            <View style={styles.syncBtnInner}>
              {syncing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Feather
                  name={isLoggedIn ? "refresh-cw" : "cloud"}
                  size={15}
                  color={isLoggedIn ? colors.accent : "#fff"}
                />
              )}
              <Text
                style={[
                  styles.syncBtnText,
                  { color: isLoggedIn ? colors.accent : "#fff" },
                ]}
              >
                {syncing ? (syncMsg || "Sync...") : isLoggedIn ? "Sync Cloud" : "Lier Compte"}
              </Text>
            </View>
          </CardPressable>
        </View>

        {/* Sync Status Banner */}
        {isLoggedIn && (
          <View style={styles.cloudBanner}>
            <Feather name="check-circle" size={13} color="#52c41a" />
            <Text style={styles.cloudBannerText}>
              Compte : <Text style={{ color: "#fff", fontWeight: "700" }}>{session.username || "nHentai"}</Text>
              {session.lastSync ? ` · Synchro à ${session.lastSync}` : ""}
            </Text>
          </View>
        )}

        {favorites.length > 0 && (
          <View style={styles.filterBar}>
            <Feather name="search" size={16} color="#9ca3af" style={{ marginRight: 8 }} />
            <TextInput
              value={filterQuery}
              onChangeText={setFilterQuery}
              placeholder="Filtrer dans les favoris..."
              placeholderTextColor="#6b7280"
              style={styles.filterInput}
            />
          </View>
        )}
      </View>

      {filtered.length === 0 ? (
        <View style={styles.centerContainer}>
          <Feather name="bookmark" size={48} color="#6b7280" style={{ opacity: 0.4 }} />
          <Text style={styles.emptyTitle}>
            {filterQuery ? "Aucun favori correspondant" : "Aucun favori enregistré"}
          </Text>
          <Text style={styles.emptySub}>
            {filterQuery
              ? "Modifiez votre recherche pour afficher vos mangas."
              : "Appuyez sur 'Lier Compte' pour importer vos favoris en ligne ou ajoutez des mangas avec le bouton signet."}
          </Text>
        </View>
      ) : (
        <FlashList
          data={filtered}
          renderItem={renderItem}
          estimatedItemSize={240}
          numColumns={numColumns}
          contentContainerStyle={{
            paddingHorizontal: horizontalPadding,
            paddingTop: 12,
            paddingBottom: insets.bottom + 24,
          }}
          keyExtractor={(item) => String(item.id)}
        />
      )}

      {/* Sign In / Cloud Sync Modal */}
      <SignInModal visible={isSignInOpen} onClose={() => setIsSignInOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#20202e",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: { fontSize: 20, fontWeight: "800", color: "#f3f4f6" },
  headerSub: { fontSize: 13, marginTop: 2, color: "#9ca3af" },
  syncBtn: {
    borderRadius: 12,
  },
  syncBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  syncBtnText: {
    fontSize: 12.5,
    fontWeight: "800",
  },
  cloudBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(82, 196, 26, 0.1)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 10,
  },
  cloudBannerText: {
    fontSize: 11.5,
    color: "#9ca3af",
  },
  filterBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#28283a",
    backgroundColor: "#161622",
    marginTop: 10,
  },
  filterInput: { flex: 1, fontSize: 13, color: "#f3f4f6" },
  centerContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyTitle: { fontSize: 16, fontWeight: "700", marginTop: 16, marginBottom: 6, color: "#f3f4f6" },
  emptySub: { fontSize: 13, textAlign: "center", lineHeight: 18, color: "#9ca3af" },
});
