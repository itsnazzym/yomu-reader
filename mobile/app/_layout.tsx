import React from "react";
import { StyleSheet, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Drawer } from "react-native-drawer-layout";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider, useTheme } from "@/lib/ThemeContext";
import { DrawerProvider, useDrawer } from "@/lib/DrawerContext";
import { SideMenu } from "@/components/SideMenu";

function AppShell() {
  const { colors } = useTheme();
  const { isOpen, openDrawer, closeDrawer } = useDrawer();

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <StatusBar style="light" backgroundColor="transparent" translucent />
      <Drawer
        open={isOpen}
        onOpen={openDrawer}
        onClose={closeDrawer}
        drawerType="front"
        drawerPosition="left"
        swipeEdgeWidth={35}
        drawerStyle={{ width: "82%", maxWidth: 320, backgroundColor: "#13131c" }}
        renderDrawerContent={() => <SideMenu closeDrawer={closeDrawer} />}
      >
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
            animation: "slide_from_right",
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="book/[id]/index" />
          <Stack.Screen name="book/[id]/comments" />
          <Stack.Screen name="read" options={{ animation: "fade" }} />
          <Stack.Screen name="batch" />
          <Stack.Screen name="downloaded" />
          <Stack.Screen name="favorites" />
          <Stack.Screen name="history" />
          <Stack.Screen name="tags/index" />
          <Stack.Screen name="recommendations" />
          <Stack.Screen name="settings/index" />
        </Stack>
      </Drawer>
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <DrawerProvider>
          <AppShell />
        </DrawerProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
