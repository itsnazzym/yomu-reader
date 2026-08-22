import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { IconBell, IconPlus, IconX } from "@tabler/icons-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/lib/ThemeContext";
import { BookCard } from "@/components/BookCard";
import { useFollowsFeed } from "@/lib/followsFeedStore";
import { setHomeSearchQuery } from "@/lib/homeSearchStore";
import { AnimatedEmptyState } from "@/components/ui/AnimatedEmptyState";

export default function UpdatesScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { rows, unseenTotal, refreshing, pinned, refresh, markSeen, pinSearch, unpinSearch } =
    useFollowsFeed();
  const [draftQuery, setDraftQuery] = useState("");

  useEffect(() => {
    void refresh(false);
  }, [refresh]);

  const handleOpenQuery = (query: string, sourceKey: string): void => {
    void markSeen(sourceKey);
    setHomeSearchQuery(query);
    router.push("/");
  };

  const handlePin = async (): Promise<void> => {
    const created = await pinSearch(draftQuery);
    if (created) {
      setDraftQuery("");
      void refresh(true);
    }
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.bg, paddingTop: Math.max(insets.top, 12) },
      ]}
    >
      <View style={[styles.header, { borderBottomColor: colors.tagBg }]}>
        <View>
          <Text style={[styles.title, { color: colors.txt }]}>Nouveautés</Text>
          <Text style={[styles.sub, { color: colors.sub }]}>
            {unseenTotal > 0
              ? `${unseenTotal} nouvelle(s) galerie(s) suivie(s)`
              : "Artistes, packs et recherches épinglées"}
          </Text>
        </View>
        <IconBell size={20} color={colors.accent} strokeWidth={2} />
      </View>

      <View style={styles.pinRow}>
        <TextInput
          value={draftQuery}
          onChangeText={setDraftQuery}
          placeholder='Suivre une recherche (ex: artist:shindol)'
          placeholderTextColor="#6b7280"
          style={[styles.pinInput, { backgroundColor: colors.page, color: colors.txt }]}
          autoCapitalize="none"
          onSubmitEditing={() => {
            void handlePin();
          }}
        />
        <Pressable
          onPress={() => {
            void handlePin();
          }}
          style={[styles.pinBtn, { backgroundColor: colors.accent }]}
          accessibilityLabel="Suivre cette recherche"
        >
          <IconPlus size={16} color="#fff" strokeWidth={2.4} />
        </Pressable>
      </View>

      {pinned.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pinnedChips}
        >
          {pinned.map((pin) => (
            <Pressable
              key={pin.id}
              onLongPress={() => {
                void unpinSearch(pin.id);
              }}
              style={[styles.chip, { borderColor: colors.tagBg, backgroundColor: colors.page }]}
            >
              <Text style={[styles.chipText, { color: colors.txt }]} numberOfLines={1}>
                {pin.query}
              </Text>
              <Pressable
                onPress={() => {
                  void unpinSearch(pin.id);
                }}
                hitSlop={8}
                accessibilityLabel={`Ne plus suivre ${pin.query}`}
              >
                <IconX size={12} color={colors.sub} strokeWidth={2} />
              </Pressable>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void refresh(true);
            }}
            tintColor={colors.accent}
          />
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        {refreshing && rows.length === 0 ? (
          <ActivityIndicator style={{ marginTop: 32 }} color={colors.accent} />
        ) : rows.length === 0 ? (
          <AnimatedEmptyState
            type="search"
            actionLabel="Explorer les tags"
            onActionPress={() => router.push("/tags")}
          />
        ) : (
          rows.map((row) => (
            <View key={row.source.key} style={styles.section}>
              <Pressable
                onPress={() => handleOpenQuery(row.source.query, row.source.key)}
                style={styles.sectionHead}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sectionTitle, { color: colors.txt }]}>{row.source.label}</Text>
                  <Text style={[styles.sectionMeta, { color: colors.sub }]}>
                    {row.source.kind === "tag"
                      ? "Tag suivi"
                      : row.source.kind === "pack"
                        ? "Pack de tags"
                        : "Recherche épinglée"}
                  </Text>
                </View>
                {row.unseenCount > 0 ? (
                  <View style={[styles.badge, { backgroundColor: colors.accent }]}>
                    <Text style={styles.badgeText}>{row.unseenCount}</Text>
                  </View>
                ) : null}
              </Pressable>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.cards}
              >
                {row.galleries.slice(0, 6).map((gallery) => (
                  <View key={gallery.id} style={{ width: 132 }}>
                    <BookCard gallery={gallery} cardWidth={132} />
                  </View>
                ))}
              </ScrollView>
            </View>
          ))
        )}
      </ScrollView>
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
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
  },
  sub: {
    fontSize: 12,
    marginTop: 2,
  },
  pinRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  pinInput: {
    flex: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
  pinBtn: {
    width: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  pinnedChips: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: 220,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
    maxWidth: 180,
  },
  section: {
    paddingTop: 14,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  sectionMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  badgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
  },
  cards: {
    paddingHorizontal: 12,
    gap: 8,
  },
});
