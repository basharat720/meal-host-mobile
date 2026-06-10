import React from "react";
import { View, ActivityIndicator, Text, StyleSheet } from "react-native";
import { colors, typography } from "@/constants/theme";

export const LoadingSpinner = ({ message }: { message?: string }) => (
  <View style={styles.container}>
    <ActivityIndicator size="large" color={colors.primary} />
    {message && <Text style={styles.text}>{message}</Text>}
  </View>
);

export const FullScreenLoader = ({ message }: { message?: string }) => (
  <View style={styles.fullScreen}>
    <ActivityIndicator size="large" color={colors.primary} />
    {message && <Text style={styles.text}>{message}</Text>}
  </View>
);

const styles = StyleSheet.create({
  container: { alignItems: "center", justifyContent: "center", padding: 32 },
  fullScreen: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  text: { ...typography.sm, color: colors.mutedForeground, marginTop: 12 },
});
