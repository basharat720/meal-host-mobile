import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useAuth } from "@/contexts/AuthContext";
import { chefService, ChefDashboardStats } from "@/services/chefService";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { colors, radius, shadow, spacing, typography } from "@/constants/theme";

interface StatCardProps {
  label: string;
  value: string | null;
  icon: keyof typeof Ionicons.glyphMap;
  loading: boolean;
}

const StatCard = ({ label, value, icon, loading }: StatCardProps) => (
  <View style={styles.statCard}>
    <View style={styles.statIconWrap}>
      <Ionicons name={icon} size={20} color={colors.primary} />
    </View>
    <Text style={styles.statLabel}>{label}</Text>
    {loading || value === null ? (
      <View style={styles.statSkeleton} />
    ) : (
      <Text style={styles.statValue}>{value}</Text>
    )}
  </View>
);

export default function DashboardScreen() {
  const { dbUser } = useAuth();
  const [stats, setStats] = useState<ChefDashboardStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const data = await chefService.getDashboardStats();
      setStats(data);
    } catch (err) {
      console.error("Failed to fetch dashboard stats:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await chefService.getDashboardStats();
      setStats(data);
    } catch (err) {
      console.error("Failed to refresh stats:", err);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchStats();
    }, [fetchStats])
  );

  const profilePictureUrl = dbUser?.chef_profile?.profile_picture_url ?? null;
  const chefName = dbUser?.name ?? "Chef";

  const statCards: { label: string; value: string | null; icon: keyof typeof Ionicons.glyphMap }[] = [
    {
      label: "Today's Orders",
      value: stats ? String(stats.todays_orders ?? 0) : null,
      icon: "bag-handle-outline",
    },
    {
      label: "Today's Earnings",
      value: stats ? `$${(stats.todays_earnings ?? 0).toFixed(2)}` : null,
      icon: "cash-outline",
    },
    {
      label: "Happy Customers",
      value: stats ? String(stats.happy_customers ?? 0) : null,
      icon: "people-outline",
    },
    {
      label: "Rating",
      value: stats ? `${(stats.rating ?? 0).toFixed(1)} ★` : null,
      icon: "star-outline",
    },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          {profilePictureUrl ? (
            <Image
              source={{ uri: profilePictureUrl }}
              style={styles.avatar}
              contentFit="cover"
            />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitial}>
                {chefName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.headerText}>
            <Text style={styles.title}>Chef Dashboard</Text>
            <Text style={styles.subtitle}>Welcome back, {chefName}</Text>
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.grid}>
          {statCards.map((card) => (
            <StatCard
              key={card.label}
              label={card.label}
              value={card.value}
              icon={card.icon}
              loading={loading}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.lg },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.secondary,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
  },
  avatarFallback: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    ...typography.xl,
    fontWeight: "700",
    color: colors.primaryForeground,
  },
  headerText: { flex: 1 },
  title: {
    ...typography["2xl"],
    fontWeight: "700",
    color: colors.foreground,
  },
  subtitle: {
    ...typography.sm,
    color: colors.mutedForeground,
    marginTop: 2,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  statCard: {
    width: "48%",
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadow.sm,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  statLabel: {
    ...typography.xs,
    color: colors.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statValue: {
    ...typography["2xl"],
    fontWeight: "700",
    color: colors.foreground,
  },
  statSkeleton: {
    height: 32,
    width: 80,
    borderRadius: radius.sm,
    backgroundColor: colors.muted,
  },
});
