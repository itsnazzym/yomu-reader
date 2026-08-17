import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/lib/ThemeContext";

interface SectionProps {
  title: string;
  subtitle?: string;
  rightAction?: React.ReactNode;
}

export function Section({ title, subtitle, rightAction }: SectionProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <Text style={[styles.title, { color: colors.title }]}>{title}</Text>
          {subtitle && (
            <Text style={[styles.subtitle, { color: colors.sub }]}>
              {subtitle}
            </Text>
          )}
        </View>
        {rightAction && <View style={styles.action}>{rightAction}</View>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  action: {
    marginLeft: 8,
  },
});
