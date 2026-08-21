import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { ErrorBoundaryProps, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Drawer } from "react-native-drawer-layout";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { enableScreens } from "react-native-screens";
import { ThemeProvider, useTheme } from "@/lib/ThemeContext";
import { DrawerProvider, useDrawer } from "@/lib/DrawerContext";
import { SideMenu } from "@/components/SideMenu";
import { TexturedBackground } from "@/components/ui/TexturedBackground";
import { OnboardingModal } from "@/components/onboarding/OnboardingModal";

enableScreens(true);

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.errorRoot, { backgroundColor: colors.bg }]}>
      <Text style={[styles.errorTitle, { color: colors.txt }]}>Écran bloqué</Text>
      <Text style={[styles.errorBody, { color: colors.sub }]}>
        {error?.message || "Erreur inconnue"}
      </Text>
      <Text style={[styles.errorRetry, { color: colors.accent }]} onPress={retry}>
        Réessayer
      </Text>
    </View>
  );
}

function AppShell() {
  const { colors } = useTheme();
  const { isOpen, openDrawer, closeDrawer } = useDrawer();

  return (
    <TexturedBackground backgroundColor={colors.bg}>
      <StatusBar style="light" backgroundColor="transparent" translucent />
      <Drawer
        open={isOpen}
        onOpen={openDrawer}
        onClose={closeDrawer}
        drawerType="front"
        drawerPosition="left"
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
            <Stack.Screen name="history" />
            <Stack.Screen name="batch" />
            <Stack.Screen name="recommendations" />
            <Stack.Screen name="profile" />
            <Stack.Screen name="tags/index" />
            <Stack.Screen name="settings/index" />
            <Stack.Screen name="api-keys/index" />
            <Stack.Screen name="book/[id]/index" />
            <Stack.Screen name="book/[id]/comments" />
            <Stack.Screen name="read" options={{ animation: "fade" }} />
            <Stack.Screen name="+not-found" />
          </Stack>
        </View>
      </Drawer>

      <OnboardingModal />
    </TexturedBackground>
  );
}

export default function RootLayout() {
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
