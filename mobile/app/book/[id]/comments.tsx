import React, { useState, useEffect } from "react";
import { StyleSheet, View, Text, ActivityIndicator } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { IconArrowLeft, IconMessageCircle } from "@tabler/icons-react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { format } from "date-fns";
import { useTheme } from "@/lib/ThemeContext";
import { getComments } from "@/lib/api/nhentai";
import { Comment } from "@/lib/api/types";
import { IconBtn } from "@/components/ui/IconBtn";
import SmartImage from "@/components/SmartImage";

export default function CommentsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getComments(id)
      .then((c) => {
        setComments(c);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  const renderItem = ({ item }: { item: Comment }) => {
    const avatar =
      typeof item.poster?.avatar_url === "string" && item.poster.avatar_url
        ? item.poster.avatar_url.startsWith("http")
          ? item.poster.avatar_url
          : `https://i.nhentai.net/avatars/${item.poster.avatar_url}`
        : "";

    const dateStr = (() => {
      if (!item.post_date) return "";
      const ts = Number(item.post_date);
      if (isNaN(ts)) return "";
      try {
        return format(new Date(ts * 1000), "dd/MM/yyyy HH:mm");
      } catch {
        return "";
      }
    })();

    return (
      <View
        style={[
          styles.commentCard,
          { backgroundColor: colors.page, borderColor: colors.tagBg },
        ]}
      >
        <View style={styles.posterRow}>
          <View style={styles.avatarWrapper}>
            {avatar ? (
              <SmartImage
                uri={avatar}
                style={styles.avatar}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: colors.accent }]}>
                <Text style={styles.avatarInitial}>
                  {item.poster?.username?.charAt(0)?.toUpperCase() || "U"}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.posterMeta}>
            <Text style={[styles.username, { color: colors.txt }]}>
              {item.poster?.username || "Anonyme"}
            </Text>
            {dateStr ? (
              <Text style={[styles.dateText, { color: colors.sub }]}>
                {dateStr}
              </Text>
            ) : null}
          </View>
        </View>

        <Text style={[styles.commentBody, { color: colors.txt }]}>{item.body}</Text>
      </View>
    );
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.bg,
          paddingTop: Math.max(insets.top, 12),
        },
      ]}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.tagBg }]}>
        <IconBtn onPress={() => router.back()} size={40}>
          <IconArrowLeft size={22} color={colors.txt} stroke={2} />
        </IconBtn>
        <Text style={[styles.headerTitle, { color: colors.txt }]}>
          Commentaires (#{id})
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.sub }]}>
            Chargement des commentaires...
          </Text>
        </View>
      ) : comments.length === 0 ? (
        <View style={styles.centerContainer}>
          <IconMessageCircle size={48} color={colors.sub} stroke={1.5} style={{ opacity: 0.5 }} />
          <Text style={[styles.emptyTitle, { color: colors.txt }]}>
            Aucun commentaire
          </Text>
          <Text style={[styles.emptySub, { color: colors.sub }]}>
            Cette galerie n'a pas encore de commentaires.
          </Text>
        </View>
      ) : (
        <FlashList
          data={comments}
          renderItem={renderItem}
          estimatedItemSize={100}
          contentContainerStyle={{
            padding: 16,
            paddingBottom: insets.bottom + 20,
          }}
          keyExtractor={(item) => String(item.id)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 17, fontWeight: "800" },
  centerContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  loadingText: { marginTop: 14, fontSize: 13.5, fontWeight: "600" },
  emptyTitle: { fontSize: 16, fontWeight: "700", marginTop: 14 },
  emptySub: { fontSize: 12.5, marginTop: 4, textAlign: "center" },
  commentCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  posterRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  avatarWrapper: { width: 36, height: 36, borderRadius: 18, overflow: "hidden" },
  avatar: { width: "100%", height: "100%" },
  avatarPlaceholder: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: "#fff", fontWeight: "800", fontSize: 14 },
  posterMeta: { flex: 1 },
  username: { fontSize: 13.5, fontWeight: "700" },
  dateText: { fontSize: 11, marginTop: 1 },
  commentBody: { fontSize: 13.5, lineHeight: 19 },
});
