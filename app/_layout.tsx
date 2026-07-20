import React, { useCallback, useEffect, useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import {
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
} from "@expo-google-fonts/nunito";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { I18nProvider } from "@/i18n/context";
import { colors } from "@/constants/theme";
import { AnimatedSplash } from "@/components/AnimatedSplash";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { configureNotificationHandler } from "@/lib/pushNotifications";

// Keep native splash visible until we're ready to show our animated one
SplashScreen.preventAutoHideAsync().catch(() => {});

// Configure foreground notification behaviour once, at module load, before any
// notification can be delivered.
configureNotificationHandler();

/**
 * Mounts the push-notification wiring. Must live UNDER AuthProvider (needs the
 * logged-in user) and the QueryClientProvider (invalidates the unread badge).
 */
function PushNotificationsGate() {
  usePushNotifications();
  return null;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, staleTime: 30_000 },
  },
});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });

  const [splashDone, setSplashDone] = useState(false);

  // Once fonts are ready, hide the native splash — our JS animated splash takes over
  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  const handleSplashComplete = useCallback(() => setSplashDone(true), []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <I18nProvider>
            <AuthProvider>
              <CartProvider>
                <StatusBar
                  style={splashDone ? "dark" : "light"}
                  backgroundColor={splashDone ? colors.background : colors.primary}
                />
                <PushNotificationsGate />
                {fontsLoaded && (
                  <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="(auth)" />
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen name="(chef)" />
                    <Stack.Screen name="chef/[id]" options={{ headerShown: false }} />
                    <Stack.Screen name="my-requests/[id]" options={{ headerShown: false }} />
                    <Stack.Screen name="notifications" options={{ headerShown: false }} />
                  </Stack>
                )}
                {fontsLoaded && !splashDone && (
                  <AnimatedSplash onComplete={handleSplashComplete} />
                )}
              </CartProvider>
            </AuthProvider>
          </I18nProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
