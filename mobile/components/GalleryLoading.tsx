import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { IconArrowLeft, IconBook2 } from "@tabler/icons-react-native";
import { useTheme } from "@/lib/ThemeContext";

export function GalleryLoading({ title, source, onBack }: {
  title?: string;
  source: string;
  onBack: () => void;
}) {
  const { colors } = useTheme();
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 6_000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.screen}>
      <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Retour"
        style={styles.back}>
        <IconArrowLeft size={22} color={colors.txt} />
        <Text style={[styles.backText, { color: colors.txt }]}>Retour</Text>
      </Pressable>
      <View style={styles.content}>
        <Text style={[styles.eyebrow, { color: colors.sub }]}>{source}</Text>
        <Text numberOfLines={3} style={[styles.title, { color: colors.txt }]}>
          {title || "Ouverture de la galerie"}
        </Text>
        <View accessible={false} style={[styles.preview, { borderColor: colors.tagBg }]}>
          <View style={[styles.cover, { backgroundColor: colors.tagBg }]}>
            <IconBook2 size={36} strokeWidth={1.2} color={colors.sub} />
          </View>
          <View style={styles.lines}>
            {["90%", "70%", "45%"].map((width) => (
              <View key={width} style={[styles.line, { width: width as `${number}%`, backgroundColor: colors.tagBg }]} />
            ))}
            <View style={[styles.pageMarks, { borderColor: colors.tagBg }]} />
          </View>
        </View>
        <View accessibilityLiveRegion="polite" style={styles.status}>
          <ActivityIndicator size="small" color={colors.sub} />
          <Text style={[styles.statusText, { color: colors.txt }]}>
            {slow ? "La source met du temps à répondre" : "Récupération de la fiche"}
          </Text>
        </View>
        <Text style={[styles.hint, { color: colors.sub }]}>
          {slow
            ? "La demande est limitée dans le temps. Si elle échoue, vous pourrez réessayer."
            : "Les informations et les pages de lecture sont demandées à la source."}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 24 },
  back: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48, alignSelf: "flex-start" },
  backText: { fontSize: 16, fontWeight: "600" },
  content: { width: "100%", maxWidth: 480, alignSelf: "center", flex: 1, justifyContent: "center", paddingBottom: 64 },
  eyebrow: { fontSize: 12, letterSpacing: 1.6, textTransform: "uppercase", fontWeight: "700", marginBottom: 12 },
  title: { fontSize: 26, lineHeight: 34, fontWeight: "700", marginBottom: 28 },
  preview: { flexDirection: "row", gap: 22, borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: 24, marginBottom: 28 },
  cover: { width: 96, height: 136, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  lines: { flex: 1, justifyContent: "center", gap: 12 },
  line: { height: 8, borderRadius: 2 },
  pageMarks: { marginTop: 14, height: 24, width: 56, borderTopWidth: 1, borderBottomWidth: 1 },
  status: { flexDirection: "row", alignItems: "center", gap: 12 },
  statusText: { flex: 1, fontSize: 15, lineHeight: 22, fontWeight: "600" },
  hint: { fontSize: 13, lineHeight: 20, marginTop: 12 },
});
