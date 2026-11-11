import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Pressable,
  Platform,
  Keyboard,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useAuth } from "@/contexts/AuthContext";
import { menuService, requestService, userService } from "@/services/api";
import { chefDisplayName } from "@/lib/chefName";
import { getUserFriendlyError } from "@/lib/errorMessages";
import { useI18n } from "@/i18n/context";
import { useTypewriter } from "@/hooks/useTypewriter";
import { DietaryTag } from "@/services/types";
import { colors, spacing, typography, radius } from "@/constants/theme";

/**
 * The only dietary requirements offered on a custom request — as on the
 * website. Codes are compared with punctuation and case stripped because the
 * backend seeds disagree (GLUTEN_FREE vs GF), and the label is set here since
 * the API returns the raw code, which is not a thing to show a customer.
 */
const OFFERED_DIETARY_TAGS = [
  { codes: ["VEGETARIAN", "VEG"], label: "Vegetarian" },
  { codes: ["GLUTENFREE", "GF"], label: "Gluten free" },
];

const normaliseTagCode = (code: string) => code.toUpperCase().replace(/[^A-Z]/g, "");

/** The placeholder cycles the same examples as the website's request form. */
const EXAMPLE_COUNT = 4;

/**
 * How far ahead a request may be placed — the same window as the website.
 * Two hours keeps short-notice requests possible while blocking times that are
 * already past or leave a chef no time to reply. An open-ended date lets
 * someone post for months out and leave the request sitting in the queue.
 */
const MIN_LEAD_MS = 2 * 60 * 60 * 1000;
const MAX_LEAD_MS = 14 * 24 * 60 * 60 * 1000;
/** The picker has minute resolution, so the earliest value it offers sits a few
 *  seconds inside the limit; without this grace it would be rejected. */
const LEAD_GRACE_MS = 60 * 1000;

/** Bounds on how many people a request may be for — the same as the website
 *  and the API. */
const MIN_PEOPLE = 1;
const MAX_PEOPLE = 100;

/**
 * The earliest time the pickers offer: the same bound the submit check uses
 * (including its grace), on a whole minute. The pickers have minute
 * resolution, so a bound with seconds in it would grey out the very minute it
 * stands for. Taken once when the picker opens so it does not creep forward
 * while the user is scrolling.
 */
const earliestPickable = () => {
  const d = new Date(Date.now() + MIN_LEAD_MS - LEAD_GRACE_MS);
  d.setSeconds(0, 0);
  return d;
};

/** The earliest allowed time, rounded up to the next 15 minutes. */
const defaultEventDate = () => {
  const d = new Date(Date.now() + MIN_LEAD_MS);
  d.setSeconds(0, 0);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15);
  return d;
};

export default function PostRequestScreen() {
  const { dbUser, loading } = useAuth();

  // Optional chefId query param — when present, this is a targeted request
  // posted from a chef's profile.
  const { chefId } = useLocalSearchParams<{ chefId?: string }>();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [numberOfPeople, setNumberOfPeople] = useState("");
  const [eventDate, setEventDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  // Fixed when the date picker opens; see earliestPickable.
  const [pickerMin, setPickerMin] = useState<Date>(earliestPickable);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [availableTags, setAvailableTags] = useState<DietaryTag[]>([]);
  const [locationId, setLocationId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // The kitchen a targeted request goes to, shown so the customer knows it is
  // private to that chef.
  const [targetChefName, setTargetChefName] = useState<string | null>(null);

  useEffect(() => {
    if (!chefId) return;
    userService
      .getUserById(chefId)
      .then((u) => setTargetChefName(chefDisplayName(u, "this chef")))
      .catch(() => setTargetChefName("this chef"));
  }, [chefId]);

  const savedLocations = dbUser?.locations ?? [];

  // Paused once there is something in the field: the placeholder is hidden
  // then, so animating it is work nobody sees.
  const { t } = useI18n();
  const titleExamples = Array.from({ length: EXAMPLE_COUNT }, (_, i) =>
    t(`landing.customRequest.examples.${i}`)
  );
  const { text: titlePlaceholder } = useTypewriter(titleExamples, {
    enabled: title === "",
  });

  const offeredTags = OFFERED_DIETARY_TAGS.flatMap(({ codes, label }) => {
    const tag = availableTags.find((tg) => codes.includes(normaliseTagCode(tg.code)));
    return tag ? [{ ...tag, label }] : [];
  });

  useEffect(() => {
    menuService.getDietaryTags().then(setAvailableTags).catch(() => {});
  }, []);

  // Default to the customer's primary saved location when available.
  useEffect(() => {
    if (locationId === null && savedLocations.length > 0) {
      const primary =
        savedLocations.find((l) => l.is_primary) ?? savedLocations[0];
      setLocationId(primary.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedLocations]);

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
        const base = prev ?? defaultEventDate();
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
    const people = Number(numberOfPeople);
    if (
      !numberOfPeople ||
      !Number.isInteger(people) ||
      people < MIN_PEOPLE ||
      people > MAX_PEOPLE
    ) {
      Alert.alert(
        "Number of people",
        `Please enter the number of people, from ${MIN_PEOPLE} to ${MAX_PEOPLE}.`
      );
      return;
    }
    if (!eventDate) {
      Alert.alert("Missing date", "Please choose when you need it.");
      return;
    }
    // The pickers' bounds are a guardrail, not a guarantee (Android picks the
    // date and time separately), so the window is enforced against the clock.
    const eventAt = eventDate.getTime();
    const submittedAt = Date.now();
    if (eventAt < submittedAt + MIN_LEAD_MS - LEAD_GRACE_MS) {
      Alert.alert(
        "Too soon",
        "Please pick a time at least 2 hours from now, so chefs have time to respond."
      );
      return;
    }
    if (eventAt > submittedAt + MAX_LEAD_MS) {
      Alert.alert("Too far ahead", "Please pick a time within the next 2 weeks.");
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
        event_time: eventDate.toISOString(),
        number_of_people: people,
        preferred_location_id: locationId ?? undefined,
        dietary_tag_ids: selectedTagIds,
        chef_id: chefId ? Number(chefId) : undefined,
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
        getUserFriendlyError(err, "Failed to post request. Please try again.")
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
          <Ionicons name="clipboard-outline" size={22} color={colors.secondaryStrong} />
          <Text style={styles.headerText}>Post a Food Request</Text>
        </View>
      </View>

      <KeyboardAwareScrollView
        bottomOffset={24}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {chefId ? (
          <View style={styles.targetBanner}>
            <Ionicons name="restaurant-outline" size={18} color={colors.primary} />
            <Text style={styles.targetBannerText}>
              Sending to <Text style={styles.targetBannerName}>{targetChefName ?? "this chef"}</Text>{" "}
              only. Other chefs won't see this request.
            </Text>
          </View>
        ) : null}
        <Card style={styles.card}>
          {/* Title */}
          <Input
            label="List your menu *"
            placeholder={titlePlaceholder}
            value={title}
            onChangeText={setTitle}
            containerStyle={styles.field}
          />

          {/* Description */}
          <Input
            label="Additional details (optional)"
            placeholder="List your dishes"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            style={styles.textarea}
            containerStyle={styles.field}
          />

          {/* Number of people — digits only, capped at MAX_PEOPLE as typed */}
          <View style={styles.field}>
            <Input
              label="Number of people *"
              placeholder="e.g. 10"
              value={numberOfPeople}
              onChangeText={(text) => {
                const digits = text.replace(/[^0-9]/g, "").slice(0, 3);
                setNumberOfPeople(
                  digits && Number(digits) > MAX_PEOPLE ? String(MAX_PEOPLE) : digits
                );
              }}
              keyboardType="number-pad"
              maxLength={3}
            />
            <Text style={styles.fieldHint}>
              From {MIN_PEOPLE} to {MAX_PEOPLE}.
            </Text>
          </View>

          {/* Event date/time */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>
              When do you need it? <Text style={styles.fieldRequired}>*</Text>
            </Text>
            <Pressable
              style={styles.datePickerButton}
              onPress={() => {
                // The scroll view keeps the keyboard up for taps, and the iOS
                // picker is pinned to the bottom — it would open behind it.
                Keyboard.dismiss();
                // Seed a valid value: the iOS spinner only reports changes, so
                // "Done" without spinning would otherwise leave it empty.
                if (!eventDate) setEventDate(defaultEventDate());
                setPickerMin(earliestPickable());
                setShowDatePicker(true);
              }}
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
            </Pressable>
            <Text style={styles.fieldHint}>Anywhere from 2 hours to 2 weeks from now.</Text>
          </View>

          {/* Preferred location */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>
              Where do you need it?{" "}
              <Text style={styles.fieldOptional}>(optional)</Text>
            </Text>
            {savedLocations.length > 0 ? (
              <View style={styles.locationList}>
                <Pressable
                  style={[
                    styles.locationRow,
                    locationId === null && styles.locationRowSelected,
                  ]}
                  onPress={() => setLocationId(null)}
                >
                  <Ionicons
                    name={
                      locationId === null
                        ? "radio-button-on"
                        : "radio-button-off"
                    }
                    size={18}
                    color={
                      locationId === null
                        ? colors.secondaryStrong
                        : colors.mutedForeground
                    }
                  />
                  <Text style={styles.locationText}>No preferred location</Text>
                </Pressable>
                {savedLocations.map((loc) => {
                  const selected = locationId === loc.id;
                  return (
                    <Pressable
                      key={loc.id}
                      style={[
                        styles.locationRow,
                        selected && styles.locationRowSelected,
                      ]}
                      onPress={() => setLocationId(loc.id)}
                    >
                      <Ionicons
                        name={
                          selected ? "radio-button-on" : "radio-button-off"
                        }
                        size={18}
                        color={
                          selected ? colors.secondaryStrong : colors.mutedForeground
                        }
                      />
                      <Text style={styles.locationText} numberOfLines={2}>
                        {loc.address || `Location #${loc.id}`}
                        {loc.is_primary ? " (primary)" : ""}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.locationEmpty}>
                No saved addresses yet. You can add one from your profile, or
                just describe the location in the details above.
              </Text>
            )}
          </View>

          {/* Dietary tags */}
          {offeredTags.length > 0 && (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>
                Dietary requirements{" "}
                <Text style={styles.fieldOptional}>(optional)</Text>
              </Text>
              <View style={styles.tagsRow}>
                {offeredTags.map((tag) => {
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
                        {tag.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}
        </Card>

        <Button
          variant="secondary"
          size="lg"
          loading={isSubmitting}
          onPress={handleSubmit}
          style={styles.submitBtn}
        >
          Post Request
        </Button>
      </KeyboardAwareScrollView>

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
            value={eventDate ?? defaultEventDate()}
            mode="datetime"
            display="spinner"
            themeVariant="light"
            textColor={colors.foreground}
            onChange={(e, d) => {
              if (d) setEventDate(d);
            }}
            minimumDate={pickerMin}
            maximumDate={new Date(Date.now() + MAX_LEAD_MS)}
          />
        </View>
      )}

      {/* Android date picker */}
      {showDatePicker && Platform.OS === "android" && (
        <DateTimePicker
          value={eventDate ?? defaultEventDate()}
          mode="date"
          display="default"
          onChange={onDateChange}
          minimumDate={pickerMin}
          maximumDate={new Date(Date.now() + MAX_LEAD_MS)}
        />
      )}
      {showTimePicker && Platform.OS === "android" && (
        <DateTimePicker
          value={eventDate ?? defaultEventDate()}
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
  targetBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySubtle,
  },
  targetBannerText: { ...typography.sm, color: colors.foreground, flex: 1 },
  targetBannerName: { fontWeight: "700" },
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
  fieldRequired: {
    color: colors.destructive,
  },
  fieldHint: {
    ...typography.xs,
    color: colors.mutedForeground,
    marginTop: 4,
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

  locationList: { gap: spacing.sm },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    backgroundColor: colors.surface,
  },
  locationRowSelected: {
    borderColor: colors.secondaryStrong,
    backgroundColor: colors.accentSubtle,
  },
  locationText: {
    flex: 1,
    ...typography.base,
    color: colors.foreground,
  },
  locationEmpty: {
    ...typography.sm,
    color: colors.mutedForeground,
    lineHeight: 20,
  },

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
  // Solid orange, as on the web's post-request cuisine chips.
  tagChipSelected: {
    borderColor: colors.secondaryStrong,
    backgroundColor: colors.secondaryStrong,
  },
  tagText: {
    ...typography.sm,
    fontWeight: "600",
    color: colors.mutedForeground,
  },
  tagTextSelected: { color: colors.secondaryForeground },

  submitBtn: { marginTop: spacing.sm },

  iosPickerContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    shadowColor: colors.primary,
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
    color: colors.secondaryStrong,
  },
});
