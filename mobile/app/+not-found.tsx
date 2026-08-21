import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/lib/ThemeContext";

export default function NotFoundScreen() {
  const { colors } = useTheme();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <Text style={[styles.title, { color: colors.txt }]}>Page introuvable</Text>
        <Link href="/" style={styles.link} accessibilityRole="link">
          <Text style={[styles.linkText, { color: colors.accent }]}>Retour à l'accueil</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 12,
  },
  link: {
    paddingVertical: 10,
  },
  linkText: {
    fontSize: 15,
    fontWeight: "700",
  },
});
