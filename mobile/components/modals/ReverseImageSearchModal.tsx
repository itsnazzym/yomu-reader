import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import {
  IconX,
  IconPhotoSearch,
  IconSearch,
  IconSparkles,
  IconBook2,
} from "@tabler/icons-react-native";
import { useRouter } from "expo-router";
import { useTheme } from "@/lib/ThemeContext";
import { SmartImage } from "@/components/SmartImage";
import { lightTap } from "@/lib/haptics";
import { searchMangaByImage, ImageSearchResult } from "@/lib/api/imsearch";

export interface ReverseImageSearchModalProps {
  visible: boolean;
  onClose: () => void;
}

export function ReverseImageSearchModal({
  visible,
  onClose,
}: ReverseImageSearchModalProps) {
  const { colors } = useTheme();
  const router = useRouter();

  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ImageSearchResult[]>([]);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!imageUrl.trim()) return;
    lightTap();
    setLoading(true);
    setSearched(true);

    try {
      const res = await searchMangaByImage(imageUrl.trim());
      setResults(res.matches);
    } catch (e) {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectResult = (item: ImageSearchResult) => {
    lightTap();
    onClose();
    if (item.page && item.page > 1) {
      router.push({
        pathname: "/read",
        params: { id: String(item.galleryId), initialPage: String(item.page - 1) },
      });
    } else {
      router.push({
        pathname: "/book/[id]",
        params: { id: String(item.galleryId) },
      });
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.card,
            { backgroundColor: "#12121a", borderColor: "#28283a" },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: "#222232" }]}>
            <View style={styles.headerTitleWrap}>
              <View style={[styles.iconWrap, { backgroundColor: "rgba(96, 165, 250, 0.15)" }]}>
                <IconPhotoSearch size={18} color="#60a5fa" stroke={2} />
              </View>
              <View>
                <Text style={styles.headerTitle}>Recherche Visuelle d'Image</Text>
                <Text style={styles.headerSub}>Trouvez un manga d'après une capture d'écran</Text>
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
              <IconX size={18} color="#9ca3af" stroke={2} />
            </Pressable>
          </View>

          {/* Search Input Box */}
          <View style={styles.inputSection}>
            <View style={[styles.inputBox, { backgroundColor: "#181824", borderColor: "#2b2b3d" }]}>
              <TextInput
                value={imageUrl}
                onChangeText={setImageUrl}
                placeholder="Collez l'URL d'une image ou capture..."
                placeholderTextColor="#6b7280"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.textInput}
              />
              <Pressable
                onPress={handleSearch}
                disabled={loading || !imageUrl.trim()}
                style={[
                  styles.searchBtn,
                  { backgroundColor: imageUrl.trim() ? colors.accent : "#2d2d3e" },
                ]}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <IconSearch size={16} color="#fff" stroke={2.5} />
                )}
              </Pressable>
            </View>
          </View>

          {/* Results List */}
          <ScrollView
            style={styles.resultsScroll}
            contentContainerStyle={styles.resultsContent}
            showsVerticalScrollIndicator={false}
          >
            {loading ? (
              <View style={styles.centerBox}>
                <ActivityIndicator size="large" color={colors.accent} />
                <Text style={styles.loadingText}>Analyse visuelle des pages en cours...</Text>
              </View>
            ) : searched && results.length === 0 ? (
              <View style={styles.centerBox}>
                <Text style={styles.emptyTitle}>Aucune correspondance trouvée</Text>
                <Text style={styles.emptySub}>
                  Vérifiez le lien de l'image ou essayez une capture de meilleure qualité.
                </Text>
              </View>
            ) : results.length > 0 ? (
              results.map((r, idx) => (
                <Pressable
                  key={idx}
                  onPress={() => handleSelectResult(r)}
                  style={[styles.resultCard, { backgroundColor: "#171724", borderColor: "#2a2a3e" }]}
                >
                  {r.coverUrl ? (
                    <SmartImage uri={r.coverUrl} style={styles.resultCover} contentFit="cover" />
                  ) : (
                    <View style={[styles.resultCover, { backgroundColor: "#232332" }]} />
                  )}
                  <View style={styles.resultMeta}>
                    <View style={styles.scoreRow}>
                      <View style={[styles.scoreBadge, { backgroundColor: "rgba(52, 211, 153, 0.15)" }]}>
                        <IconSparkles size={11} color="#34d399" stroke={2} />
                        <Text style={styles.scoreText}>{r.score}% Match</Text>
                      </View>
                      {r.page ? (
                        <Text style={styles.pageText}>Page {r.page}</Text>
                      ) : null}
                    </View>
                    <Text style={styles.resultTitle} numberOfLines={2}>
                      {r.title}
                    </Text>
                    <View style={styles.actionPrompt}>
                      <IconBook2 size={12} color={colors.accent} stroke={2} />
                      <Text style={[styles.actionPromptText, { color: colors.accent }]}>
                        Ouvrir le manga #{r.galleryId}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              ))
            ) : (
              <View style={styles.hintBox}>
                <Text style={styles.hintTitle}>Conseils de recherche visuelle :</Text>
                <Text style={styles.hintItem}>• Utilisez une capture d'écran nette d'une page de manga.</Text>
                <Text style={styles.hintItem}>• Évitez les images trop recadrées ou avec trop de texte superflu.</Text>
              </View>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  card: {
    width: "100%",
    maxWidth: 440,
    maxHeight: "82%",
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#f3f4f6",
  },
  headerSub: {
    fontSize: 11,
    color: "#9ca3af",
    marginTop: 1,
  },
  closeBtn: {
    padding: 4,
  },
  inputSection: {
    padding: 14,
  },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    paddingLeft: 12,
    paddingRight: 4,
    height: 42,
  },
  textInput: {
    flex: 1,
    fontSize: 13,
    color: "#f3f4f6",
    padding: 0,
  },
  searchBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  resultsScroll: {
    maxHeight: 380,
  },
  resultsContent: {
    paddingHorizontal: 14,
    paddingBottom: 16,
    gap: 10,
  },
  centerBox: {
    paddingVertical: 32,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadingText: {
    fontSize: 12.5,
    color: "#9ca3af",
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#f3f4f6",
  },
  emptySub: {
    fontSize: 11.5,
    color: "#9ca3af",
    textAlign: "center",
    maxWidth: 260,
  },
  resultCard: {
    flexDirection: "row",
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
    padding: 8,
    gap: 10,
  },
  resultCover: {
    width: 60,
    height: 85,
    borderRadius: 6,
  },
  resultMeta: {
    flex: 1,
    justifyContent: "space-between",
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  scoreBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  scoreText: {
    fontSize: 10.5,
    fontWeight: "800",
    color: "#34d399",
  },
  pageText: {
    fontSize: 10.5,
    color: "#9ca3af",
    fontWeight: "600",
  },
  resultTitle: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#f3f4f6",
    lineHeight: 16,
  },
  actionPrompt: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  actionPromptText: {
    fontSize: 11,
    fontWeight: "700",
  },
  hintBox: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.03)",
    gap: 4,
  },
  hintTitle: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#9ca3af",
    marginBottom: 2,
  },
  hintItem: {
    fontSize: 11,
    color: "#6b7280",
    lineHeight: 16,
  },
});
