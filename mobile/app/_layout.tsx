import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  StyleSheet,
  Text,
  View,
  type AppStateStatus,
  type LayoutChangeEvent,
} from "react-native";
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
import { initReaderSettings } from "@/lib/readerSettingsStore";
import { initFavorites } from "@/lib/favoritesStore";
import { initHistory } from "@/lib/historyStore";
import { initDownloadSettings } from "@/lib/downloadSettingsStore";
import { initDownloadQueue } from "@/lib/downloadQueueStore";
import { initAppLock } from "@/lib/appLockStore";
import { initOnboarding } from "@/lib/useOnboarding";
import { initPrivacyCaptureStore } from "@/lib/privacyCaptureStore";

SplashScreen.preventAutoHideAsync().catch(() => {});
enableScreens(true);

let nativeSplashHidden = false;

function hideNativeSplash(): void {
  if (nativeSplashHidden) return;
  nativeSplashHidden = true;
  void SplashScreen.hideAsync().catch(() => {});
}

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
        void import("@/lib/cloudSync").then(({ syncNow }) => syncNow()).catch(() => {});
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
      <StartupProgress />
    </TexturedBackground>
  );
}

type StartupTask = {
  id: string;
  label: string;
  run: () => Promise<void>;
};

type StartupTaskStatus = "pending" | "running" | "success" | "failed" | "timed_out";
type StartupTaskState = Record<string, StartupTaskStatus>;
const STARTUP_TASK_TIMEOUT_MS = 2800;

const STARTUP_TASKS: StartupTask[] = [
  { id: "reader", label: "Préférences de lecture", run: initReaderSettings },
  { id: "library", label: "Bibliothèque", run: () => Promise.all([initFavorites(), initHistory()]).then(() => {}) },
  { id: "downloads", label: "Téléchargements", run: () => Promise.all([initDownloadSettings(), initDownloadQueue()]).then(() => {}) },
  { id: "security", label: "Sécurité", run: () => Promise.all([initAppLock(), initPrivacyCaptureStore()]).then(() => {}) },
  { id: "onboarding", label: "Configuration", run: initOnboarding },
];

/**
 * Indicateur de démarrage applicatif. Chaque segment correspond à une lecture
 * réellement terminée (ou en erreur) : aucune requête réseau n'est bloquante au lancement.
 */
function StartupProgress(): React.ReactElement | null {
  const { colors } = useTheme();
  const [taskStates, setTaskStates] = useState<StartupTaskState>(() =>
    Object.fromEntries(STARTUP_TASKS.map((task) => [task.id, "pending"]))
  );
  const [visible, setVisible] = useState(true);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const update = (id: string, status: StartupTaskStatus): void => {
      if (!mounted.current) return;
      setTaskStates((current) => ({ ...current, [id]: status }));
    };

    for (const task of STARTUP_TASKS) {
      update(task.id, "running");
      void Promise.race([
        task.run(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("startup timeout")), STARTUP_TASK_TIMEOUT_MS)
        ),
      ])
        .then(() => update(task.id, "success"))
        .catch((error: unknown) =>
          update(task.id, error instanceof Error && error.message === "startup timeout" ? "timed_out" : "failed")
        );
    }

    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const completed = Object.values(taskStates).filter((status) =>
      status === "success" || status === "failed" || status === "timed_out"
    ).length;
    if (completed !== STARTUP_TASKS.length) return;
    const timer = setTimeout(() => setVisible(false), 250);
    return () => clearTimeout(timer);
  }, [taskStates]);

  useEffect(() => {
    // L'interface reste disponible si un pilote de stockage est défaillant.
    // Les tâches continuent en arrière-plan, mais l'écran de lancement ne peut
    // jamais redevenir un écran bloquant.
    const fallback = setTimeout(() => setVisible(false), 3000);
    return () => clearTimeout(fallback);
  }, []);

  if (!visible) return null;

  const completed = Object.values(taskStates).filter((status) =>
    status === "success" || status === "failed" || status === "timed_out"
  ).length;
  const current = STARTUP_TASKS.find((task) => taskStates[task.id] === "running" || taskStates[task.id] === "pending");
  const progress = completed / STARTUP_TASKS.length;
  return (
    <View
      pointerEvents="none"
      style={[styles.startupOverlay, { backgroundColor: colors.bg }]}
      accessibilityLiveRegion="polite"
      accessibilityLabel={`Démarrage : ${completed} sur ${STARTUP_TASKS.length}`}
    >
      <Text style={[styles.startupTitle, { color: colors.txt }]}>Préparation de Yomu</Text>
      <Text style={[styles.startupLabel, { color: colors.sub }]}>
        {current ? current.label : "Prêt"}
      </Text>
      <View style={[styles.startupTrack, { backgroundColor: colors.tagBg }]}>
        <View style={[styles.startupFill, { backgroundColor: colors.accent, width: `${progress * 100}%` }]} />
      </View>
      <Text style={[styles.startupCount, { color: colors.sub }]}>
        {completed} / {STARTUP_TASKS.length}
      </Text>
    </View>
  );
}

export default function RootLayout() {
  useFonts({
    ...Feather.font,
  });

  useEffect(() => {
    // Sentry ne fait pas partie du chemin critique de rendu.
    initGlitchTip();
  }, []);

  useEffect(() => {
    // Dernier filet de sécurité : aucun chargement (police, stockage ou natif)
    // ne peut retenir indéfiniment le splash Android/iOS.
    const fallback = setTimeout(hideNativeSplash, 1200);
    return () => clearTimeout(fallback);
  }, []);

  const onRootLayout = useCallback((_event: LayoutChangeEvent) => {
    // La première vue de React est prête : le logo natif peut disparaître.
    hideNativeSplash();
  }, []);

  return (
    <GestureHandlerRootView style={styles.flex} onLayout={onRootLayout}>
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
  startupOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 120,
    elevation: 120,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 42,
  },
  startupTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 6,
  },
  startupLabel: {
    fontSize: 13,
    marginBottom: 16,
  },
  startupTrack: {
    width: "100%",
    maxWidth: 280,
    height: 7,
    borderRadius: 99,
    overflow: "hidden",
  },
  startupFill: {
    height: "100%",
    borderRadius: 99,
  },
  startupCount: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 8,
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
