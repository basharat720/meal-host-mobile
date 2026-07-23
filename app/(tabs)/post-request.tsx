import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  Pressable,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useAuth } from "@/contexts/AuthContext";
import { menuService, requestService } from "@/services/api";
import { DietaryTag } from "@/services/types";
import { colors, spacing, typography, radius } from "@/constants/theme";

export default function PostRequestScreen() {
  const { dbUser, loading } = useAuth();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [availableTags, setAvailableTags] = useState<DietaryTag[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    menuService.getDietaryTags().then(setAvailableTags).catch(() => {});
  }, []);

  const toggleTag = (id: number) => {
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const onDateChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }
    if (selected) {
      setEventDate((prev) => {
        if (!prev) return selected;
        // keep existing time
        const merged = new Date(selected);
        merged.setHours(prev.getHours(), prev.getMinutes(), 0, 0);
        return merged;
      });
      if (Platform.OS === "android") {
        setShowTimePicker(true);
      }
    }
  };

  const onTimeChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === "android") {
      setShowTimePicker(false);
    }
    if (selected) {
      setEventDate((prev) => {
        const base = prev ?? new Date();
        const merged = new Date(base);
        merged.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
        return merged;
      });
    }
  };

  const formatDisplayDate = (d: Date) =>
    d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert("Missing title", "Please enter a title for your request.");
      return;
    }
    if (!dbUser) {
      Alert.alert("Not signed in", "Please sign in to post a request.");
      return;
    }

    setIsSubmitting(true);
    try {
      await requestService.createRequest({
        customer_id: dbUser.id as number,
        title: title.trim(),
        description: description.trim() || undefined,
        event_time: eventDate ? eventDate.toISOString() : undefined,
        dietary_tag_ids: selectedTagIds,
      });
      Alert.alert("Request posted!", "Chefs will respond soon.", [
        {
          text: "OK",
          onPress: () => router.replace("/(tabs)/my-requests"),
        },
      ]);
    } catch (err: any) {
      Alert.alert(
        "Error",
        err?.message ?? "Failed to post request. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <LoadingSpinner message="Loading..." />
      </SafeAreaView>
    );
  }

  if (!dbUser) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Ionicons
            name="person-circle-outline"
            size={56}
            color={colors.mutedForeground}
          />
          <Text style={styles.signInTitle}>Sign in required</Text>
          <Text style={styles.signInDesc}>
            Please sign in to post a food request.
          </Text>
          <Button
            size="lg"
            style={styles.signInButton}
            onPress={() =>
              router.push({
                pathname: "/(auth)/customer-login",
                params: { redirect: "/(tabs)/post-request" },
              })
            }
          >
            Sign In
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </Pressable>
        <View style={styles.headerTitle}>
          <Ionicons name="clipboard-outline" size={22} color={colors.primary} />
          <Text style={styles.headerText}>Post a Food Request</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Card style={styles.card}>
          {/* Title */}
          <Input
            label="What are you looking for? *"
            placeholder="e.g. Birthday party catering for 20 people"
            value={title}
            onChangeText={setTitle}
            containerStyle={styles.field}
          />

          {/* Description */}
          <Input
            label="Additional details (optional)"
            placeholder="Describe what you'd like — cuisine, portions, budget, any preferences..."
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            style={styles.textarea}
            containerStyle={styles.field}
          />

          {/* Event date/time */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>
              When do you need it?{" "}
              <Text style={styles.fieldOptional}>(optional)</Text>
            </Text>
            <Pressable
              style={styles.datePickerButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons
                name="calendar-outline"
                size={18}
                color={eventDate ? colors.primary : colors.mutedForeground}
                style={styles.dateIcon}
              />
              <Text
                style={[
                  styles.datePickerText,
                  !eventDate && styles.datePlaceholder,
                ]}
              >
                {eventDate ? formatDisplayDate(eventDate) : "Select date & time"}
              </Text>
              {eventDate && (
                <Pressable
                  hitSlop={8}
                  onPress={() => setEventDate(null)}
                >
                  <Ionicons
                    name="close-circle"
                    size={18}
                    color={colors.mutedForeground}
                  />
                </Pressable>
              )}
            </Pressable>
          </View>

          {/* Dietary tags */}
          {availableTags.length > 0 && (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>
                Dietary requirements{" "}
                <Text style={styles.fieldOptional}>(optional)</Text>
              </Text>
              <View style={styles.tagsRow}>
                {availableTags.map((tag) => {
                  const selected = selectedTagIds.includes(tag.id);
                  return (
                    <Pressable
                      key={tag.id}
                      style={[styles.tagChip, selected && styles.tagChipSelected]}
                      onPress={() => toggleTag(tag.id)}
                    >
                      <Text
                        style={[
                          styles.tagText,
                          selected && styles.tagTextSelected,
                        ]}
                      >
                        {tag.code}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}
        </Card>

        <Button
          size="lg"
          loading={isSubmitting}
          onPress={handleSubmit}
          style={styles.submitBtn}
        >
          Post Request
        </Button>
      </ScrollView>

      {/* iOS date picker shown inline in a modal-like style */}
      {showDatePicker && Platform.OS === "ios" && (
        <View style={styles.iosPickerContainer}>
          <View style={styles.iosPickerHeader}>
            <Text style={styles.iosPickerLabel}>Select Date & Time</Text>
            <Pressable onPress={() => setShowDatePicker(false)}>
              <Text style={styles.iosPickerDone}>Done</Text>
            </Pressable>
          </View>
          <DateTimePicker
            value={eventDate ?? new Date()}
            mode="datetime"
            display="spinner"
            onChange={(e, d) => {
              if (d) setEventDate(d);
            }}
            minimumDate={new Date()}
          />
        </View>
      )}

      {/* Android date picker */}
      {showDatePicker && Platform.OS === "android" && (
        <DateTimePicker
          value={eventDate ?? new Date()}
          mode="date"
          display="default"
          onChange={onDateChange}
          minimumDate={new Date()}
        />
      )}
      {showTimePicker && Platform.OS === "android" && (
        <DateTimePicker
          value={eventDate ?? new Date()}
          mode="time"
          display="default"
          onChange={onTimeChange}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  signInTitle: {
    ...typography.xl,
    fontWeight: "700",
    color: colors.foreground,
    marginTop: spacing.md,
    textAlign: "center",
  },
  signInDesc: {
    ...typography.base,
    color: colors.mutedForeground,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  signInButton: { marginTop: spacing.lg, alignSelf: "stretch" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backBtn: { padding: spacing.xs, marginRight: spacing.sm },
  headerTitle: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  headerText: {
    ...typography.lg,
    fontWeight: "700",
    color: colors.foreground,
  },

  content: {
    padding: spacing.md,
    paddingBottom: spacing["2xl"],
  },
  card: { marginBottom: spacing.md },
  field: { marginBottom: spacing.md },

  fieldLabel: {
    ...typography.sm,
    fontWeight: "600",
    color: colors.foreground,
    marginBottom: 6,
  },
  fieldOptional: {
    fontWeight: "400",
    color: colors.mutedForeground,
  },

  textarea: {
    minHeight: 96,
    paddingTop: 10,
  },

  datePickerButton: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    backgroundColor: colors.surface,
  },
  dateIcon: { marginRight: spacing.sm },
  datePickerText: {
    flex: 1,
    ...typography.base,
    color: colors.foreground,
  },
  datePlaceholder: { color: colors.mutedForeground },

  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  tagChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tagChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.accent,
  },
  tagText: {
    ...typography.sm,
    fontWeight: "600",
    color: colors.mutedForeground,
  },
  tagTextSelected: { color: colors.primary },

  submitBtn: { marginTop: spacing.sm },

  iosPickerContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 8,
  },
  iosPickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iosPickerLabel: {
    ...typography.md,
    fontWeight: "600",
    color: colors.foreground,
  },
  iosPickerDone: {
    ...typography.md,
    fontWeight: "700",
    color: colors.primary,
  },
});
