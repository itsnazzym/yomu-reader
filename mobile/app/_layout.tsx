import React, { useEffect } from "react";
import { AppState, StyleSheet, Text, View, type AppStateStatus } from "react-native";
import { ErrorBoundaryProps, Stack, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Drawer } from "react-native-drawer-layout";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { enableScreens } from "react-native-screens";
import * as Linking from "expo-linking";
import { ThemeProvider, useTheme } from "@/lib/ThemeContext";
import { DrawerProvider, useDrawer } from "@/lib/DrawerContext";
import { SideMenu } from "@/components/SideMenu";
import { TexturedBackground } from "@/components/ui/TexturedBackground";
import { OnboardingModal } from "@/components/onboarding/OnboardingModal";
import { FolderPromptModal } from "@/components/modals/FolderPromptModal";
import { maybeRunAutobackup } from "@/lib/backupStore";
import { refreshFollowsFeed } from "@/lib/followsFeedStore";
import { AppLockGate } from "@/components/AppLockGate";
import { usePrivacyGuard } from "@/lib/privacyCaptureStore";
import { parseGalleryDeepLink } from "@/lib/deepLinks";
import { initGlitchTip } from "@/lib/glitchTip";
import { maybeAutoCheckOtaUpdate } from "@/lib/otaUpdates";

SplashScreen.preventAutoHideAsync().catch(() => {});
enableScreens(true);
initGlitchTip();

const ERROR_FALLBACK_COLORS = {
  bg: "#121218",
  txt: "#F2F2F5",
  sub: "#9A9AA8",
  accent: "#C45CFF",
} as const;

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  // Expo Router renders this outside ThemeProvider. Never call useTheme here.
  return (
    <View style={[styles.errorRoot, { backgroundColor: ERROR_FALLBACK_COLORS.bg }]}>
      <Text style={[styles.errorTitle, { color: ERROR_FALLBACK_COLORS.txt }]}>Écran bloqué</Text>
      <Text style={[styles.errorBody, { color: ERROR_FALLBACK_COLORS.sub }]}>
        {error?.message || "Erreur inconnue"}
      </Text>
      <Text style={[styles.errorRetry, { color: ERROR_FALLBACK_COLORS.accent }]} onPress={retry}>
        Réessayer
      </Text>
    </View>
  );
}

function AppShell() {
  const { colors } = useTheme();
  const { isOpen, openDrawer, closeDrawer, swipeEnabled } = useDrawer();
  const router = useRouter();
  // FLAG_SECURE : bloque captures d'écran + vignette multitâche (défaut ON).
  usePrivacyGuard();

  useEffect(() => {
    void maybeRunAutobackup();
    void refreshFollowsFeed(false);
    void maybeAutoCheckOtaUpdate();
    const onAppState = (next: AppStateStatus): void => {
      if (next === "active") {
        void refreshFollowsFeed(false);
        void maybeAutoCheckOtaUpdate();
      }
    };
    const sub = AppState.addEventListener("change", onAppState);
    return () => {
      sub.remove();
    };
  }, []);

  // Deep links : yomureader://gallery/<id> → fiche livre (pas /read direct).
  useEffect(() => {
    const navigateFromUrl = (url: string | null): void => {
      if (!url) return;
      try {
        const target = parseGalleryDeepLink(url);
        if (!target?.id) return;
        router.push({
          pathname: "/book/[id]",
          params: {
            id: target.id,
            ...(target.src ? { src: target.src } : {}),
          },
        });
      } catch (err) {
        console.warn("[deepLink] navigation failed:", err);
      }
    };

    void Linking.getInitialURL()
      .then((url) => navigateFromUrl(url))
      .catch(() => {});

    const sub = Linking.addEventListener("url", ({ url }) => {
      navigateFromUrl(url);
    });
    return () => {
      sub.remove();
    };
  }, [router]);

  return (
    <TexturedBackground backgroundColor={colors.bg}>
      <StatusBar style="light" backgroundColor="transparent" translucent />
      <Drawer
        open={isOpen}
        onOpen={openDrawer}
        onClose={closeDrawer}
        drawerType="front"
        drawerPosition="left"
        swipeEnabled={swipeEnabled}
        swipeEdgeWidth={35}
        style={styles.flex}
        drawerStyle={{ width: "82%", maxWidth: 320, backgroundColor: colors.menuBg }}
        renderDrawerContent={() => <SideMenu closeDrawer={closeDrawer} />}
      >
        <View style={[styles.stackHost, { backgroundColor: colors.bg }]}>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { flex: 1, backgroundColor: colors.bg },
              animation: "slide_from_right",
              freezeOnBlur: true,
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="favorites" />
            <Stack.Screen name="downloaded" />
            <Stack.Screen name="collections/index" />
            <Stack.Screen name="collections/[id]" />
            <Stack.Screen name="history" />
            <Stack.Screen name="updates" />
            <Stack.Screen name="batch" />
            <Stack.Screen name="recommendations" />
            <Stack.Screen name="profile" />
            <Stack.Screen name="tags/index" />
            <Stack.Screen name="settings/index" />
            <Stack.Screen name="settings/storage" />
            <Stack.Screen name="api-keys/index" />
            <Stack.Screen name="book/[id]/index" />
            <Stack.Screen name="book/[id]/comments" />
            <Stack.Screen name="read" options={{ animation: "fade" }} />
            <Stack.Screen name="+not-found" />
          </Stack>
        </View>
      </Drawer>

      <OnboardingModal />
      <FolderPromptModal />
      <AppLockGate />
    </TexturedBackground>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    ...Feather.font,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider style={styles.flex}>
        <ThemeProvider>
          <DrawerProvider>
            <AppShell />
          </DrawerProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  stackHost: {
    flex: 1,
  },
  errorRoot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 10,
  },
  errorBody: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 16,
  },
  errorRetry: {
    fontSize: 15,
    fontWeight: "700",
  },
});
