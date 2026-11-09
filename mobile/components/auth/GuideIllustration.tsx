import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import type { AuthGuide } from "@/lib/authGuides";
import { useTheme } from "@/lib/ThemeContext";

/** Native text and rules: works offline, scales with Android fonts, no asset URI. */
export function GuideIllustration({ guide }: { guide: AuthGuide }) {
  const { colors } = useTheme();
  return <View style={[styles.diagram, { borderColor: colors.tagBg, backgroundColor: colors.bg }]}>
    <View style={styles.heading}>
      <Text style={[styles.location, { color: colors.sub }]}>{guide.location}</Text>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.txt }]}>{guide.illustrationTitle}</Text>
    </View>
    {guide.sequence && <View style={[styles.sequence, { borderColor: colors.tagBg }]}>
      {guide.sequence.map((action, index) => <View key={action} style={styles.sequenceStep}>
        <Text style={[styles.ordinal, { color: colors.sub }]}>{index + 1}</Text>
        <Text style={[styles.action, { color: colors.txt }]}>{action}</Text>
      </View>)}
    </View>}
    {guide.fields.map((field, index) => <View key={field.name} style={[styles.field, { borderTopColor: colors.tagBg }]}>
      <View style={styles.fieldHeading}>
        <View style={[styles.marker, { backgroundColor: colors.tagBg }]}>
          <Text style={[styles.markerText, { color: colors.txt }]}>{index + 1}</Text>
        </View>
        <Text style={[styles.fieldName, { color: colors.txt }]}>{field.name}</Text>
      </View>
      <View style={styles.annotation}>
        <Text style={[styles.note, { color: colors.sub }]}>{field.note}</Text>
        <Text style={[styles.destination, { color: colors.metaText }]}>Dans Yomu : {field.destination}</Text>
      </View>
    </View>)}
    <Text style={[styles.caption, { color: colors.sub }]}>Schéma explicatif · aucune donnée de compte affichée</Text>
  </View>;
}

const styles = StyleSheet.create({
  diagram: { borderWidth: 1, borderRadius: 14, overflow: "hidden", marginBottom: 24 },
  heading: { padding: 16, gap: 8 },
  location: { fontSize: 12, lineHeight: 18 },
  title: { fontSize: 17, fontWeight: "600" },
  sequence: { paddingHorizontal: 16, paddingBottom: 16, gap: 10, borderBottomWidth: 1 },
  sequenceStep: { flexDirection: "row", alignItems: "baseline", gap: 10 },
  ordinal: { fontSize: 12, minWidth: 16 },
  action: { flex: 1, minWidth: 0, fontSize: 13 },
  field: { borderTopWidth: 1, padding: 16, gap: 8 },
  fieldHeading: { flexDirection: "row", alignItems: "center", gap: 10 },
  marker: { minWidth: 24, minHeight: 24, padding: 4, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  markerText: { fontSize: 11, fontWeight: "700" },
  fieldName: { flex: 1, minWidth: 0, fontSize: 14, fontWeight: "600", fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  annotation: { paddingLeft: 34, gap: 6 },
  note: { fontSize: 13, lineHeight: 19 },
  destination: { fontSize: 12, lineHeight: 18 },
  caption: { fontSize: 11, lineHeight: 16, padding: 16, paddingTop: 4 },
});
