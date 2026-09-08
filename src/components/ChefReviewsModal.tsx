import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { reviewService } from "@/services/api";
import { Review } from "@/services/types";
import { colors, fonts, radius, spacing, typography } from "@/constants/theme";

/** Five stars with the first `stars` filled in. */
export const StarRow = ({
  stars,
  size = 14,
}: {
  stars: number;
  size?: number;
}) => (
  <View style={styles.starRow} accessibilityLabel={`${stars} out of 5`}>
    {[1, 2, 3, 4, 5].map((i) => (
      <Ionicons
        key={i}
        name={i <= stars ? "star" : "star-outline"}
        size={size}
        color={i <= stars ? colors.warning : colors.mutedForeground}
      />
    ))}
  </View>
);

interface ChefReviewsModalProps {
  /** Numeric chef id — same as the chef's user id in the backend. */
  chefId: number | null;
  visible: boolean;
  onClose: () => void;
}

/**
 * The chef's own reviews, read-only. Reuses the public
 * `GET /reviews/?chef_id=` list rather than a chef-specific endpoint.
 */
export const ChefReviewsModal = ({
  chefId,
  visible,
  onClose,
}: ChefReviewsModalProps) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || chefId == null) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    reviewService
      .getChefReviews(chefId)
      .then((data) => {
        if (!cancelled) setReviews(data ?? []);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load your reviews. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [visible, chefId]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.sheet} edges={["top"]}>
        <View style={styles.header}>
          <Text style={styles.title}>
            Reviews
            {!isLoading && !error && reviews.length > 0 ? ` (${reviews.length})` : ""}
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={24} color={colors.foreground} />
          </Pressable>
        </View>

        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : error ? (
          <View style={styles.centered}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : reviews.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyTitle}>No reviews yet</Text>
            <Text style={styles.emptyBody}>
              Reviews appear here once customers rate their completed orders.
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {reviews.map((review) => (
              <View key={review.id} style={styles.reviewRow}>
                <View style={styles.reviewTop}>
                  <StarRow stars={review.stars} />
                  <Text style={styles.reviewDate}>
                    {new Date(review.created_at).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </Text>
                </View>
                {!!review.comment && <Text style={styles.reviewComment}>{review.comment}</Text>}
                {!!review.customer_name && (
                  <Text style={styles.reviewAuthor}>— {review.customer_name}</Text>
                )}
              </View>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    ...typography.lg,
    fontFamily: fonts.sansBold,
    fontWeight: "700",
    color: colors.foreground,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.xs,
  },
  errorText: { ...typography.base, color: colors.destructive, textAlign: "center" },
  emptyTitle: {
    ...typography.base,
    fontFamily: fonts.sansSemiBold,
    fontWeight: "600",
    color: colors.foreground,
  },
  emptyBody: { ...typography.sm, color: colors.mutedForeground, textAlign: "center" },

  list: { padding: spacing.md, gap: spacing.md },
  reviewRow: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    padding: spacing.md,
    gap: 4,
  },
  reviewTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  starRow: { flexDirection: "row", alignItems: "center", gap: 1 },
  reviewDate: { ...typography.xs, color: colors.mutedForeground },
  reviewComment: { ...typography.sm, color: colors.foreground },
  reviewAuthor: { ...typography.xs, color: colors.mutedForeground },
});
