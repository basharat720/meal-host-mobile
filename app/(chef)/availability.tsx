import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Switch,
  Modal,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useAuth } from "@/contexts/AuthContext";
import { availabilityService } from "@/services/availabilityService";
import { userService } from "@/services/userService";
import { AvailabilitySlot } from "@/services/types";
import { Button } from "@/components/ui/Button";
import { colors, fonts, radius, spacing, typography } from "@/constants/theme";

// day_of_week: 0 = Monday … 6 = Sunday (matches backend + web).
const DAYS_FULL = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

interface DayState {
  enabled: boolean;
  open_time: string; // "HH:MM"
  close_time: string; // "HH:MM"
}

const makeDefaultDays = (): DayState[] =>
  Array.from({ length: 7 }, () => ({
    enabled: false,
    open_time: "09:00",
    close_time: "21:00",
  }));

// "HH:MM" -> Date (today at that time). Falls back to 09:00 on bad input.
function hhmmToDate(hhmm: string): Date {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  const d = new Date();
  d.setHours(Number.isFinite(h) ? h : 9, Number.isFinite(m) ? m : 0, 0, 0);
  return d;
}

function dateToHhmm(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

// "HH:MM" -> minutes since midnight, for comparison.
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

// 12-hour display for chips, e.g. "9:00 AM".
function displayTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  const hour = Number.isFinite(h) ? h : 0;
  const min = Number.isFinite(m) ? m : 0;
  const period = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(min).padStart(2, "0")} ${period}`;
}

type PickerTarget = { dayIndex: number; field: "open_time" | "close_time" };

export default function AvailabilityScreen() {
  const { dbUser, refreshDbUser } = useAuth();

  const [days, setDays] = useState<DayState[]>(makeDefaultDays);
  const [defaultPrepTime, setDefaultPrepTime] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingAvail, setSavingAvail] = useState(false);
  const [savingPrep, setSavingPrep] = useState(false);
  const [picker, setPicker] = useState<PickerTarget | null>(null);

  // Initial load: existing slots + saved default prep time.
  useEffect(() => {
    if (!dbUser?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const slots = await availabilityService.getAvailability(
          dbUser.id as number
        );
        if (cancelled) return;
        const next = makeDefaultDays();
        slots.forEach((s) => {
          if (s.day_of_week >= 0 && s.day_of_week < 7) {
            next[s.day_of_week] = {
              enabled: true,
              open_time: s.open_time,
              close_time: s.close_time,
            };
          }
        });
        setDays(next);
      } catch (err) {
        if (__DEV__) console.warn("Failed to fetch availability:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dbUser?.id]);

  // Sync the prep-time field from the saved chef profile (minutes -> hours).
  useEffect(() => {
    const saved = dbUser?.chef_profile?.default_prep_time_minutes;
    if (saved != null) {
      setDefaultPrepTime((saved / 60).toFixed(2).replace(/\.?0+$/, ""));
    } else {
      setDefaultPrepTime("");
    }
  }, [dbUser?.chef_profile?.default_prep_time_minutes]);

  const updateDay = useCallback((i: number, patch: Partial<DayState>) => {
    setDays((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], ...patch };
      return next;
    });
  }, []);

  const applyMondayToWeekdays = () => {
    setDays((prev) =>
      prev.map((d, i) => ({
        ...d,
        enabled: i < 5,
        open_time: prev[0].open_time,
        close_time: prev[0].close_time,
      }))
    );
  };

  const applyToAllDays = () => {
    setDays((prev) =>
      prev.map((d) => ({
        ...d,
        enabled: true,
        open_time: prev[0].open_time,
        close_time: prev[0].close_time,
      }))
    );
  };

  const onPickerChange = (event: DateTimePickerEvent, selected?: Date) => {
    // Android fires a single event and dismisses itself; iOS updates live.
    if (Platform.OS === "android") {
      setPicker(null);
      if (event.type === "dismissed" || !selected || !picker) return;
      updateDay(picker.dayIndex, { [picker.field]: dateToHhmm(selected) });
      return;
    }
    if (selected && picker) {
      updateDay(picker.dayIndex, { [picker.field]: dateToHhmm(selected) });
    }
  };

  const saveDefaultPrepTime = async () => {
    if (!dbUser?.id) return;
    const trimmed = defaultPrepTime.trim();
    const hours = trimmed === "" ? undefined : parseFloat(trimmed);
    if (hours !== undefined && (isNaN(hours) || hours <= 0)) {
      Alert.alert("Invalid time", "Please enter a valid prep time in hours.");
      return;
    }
    setSavingPrep(true);
    try {
      const minutes = hours !== undefined ? Math.round(hours * 60) : undefined;
      // Preserve the chef's existing arrays — normalizeUserPayload otherwise
      // blanks specialties/dietary_tags/documents, which the backend would then
      // overwrite. Mirrors the safe pattern in ProfileScreen.
      await userService.updateUser(dbUser.id as number, {
        chef_profile: {
          default_prep_time_minutes: minutes,
          specialties: dbUser.chef_profile?.specialties ?? [],
          dietary_tags: dbUser.chef_profile?.dietary_tags ?? [],
          documents: dbUser.chef_profile?.documents ?? [],
        },
      });
      // Keep context in sync so the field prefills correctly on re-entry.
      await refreshDbUser();
      Alert.alert("Saved", "Default prep time saved.");
    } catch (err: any) {
      Alert.alert("Failed", err?.message ?? "Failed to save default prep time.");
    } finally {
      setSavingPrep(false);
    }
  };

  const saveAvailability = async () => {
    if (!dbUser?.id) return;

    // Validate enabled days have a close time after the open time.
    const invalid = days.find(
      (d) => d.enabled && toMinutes(d.close_time) <= toMinutes(d.open_time)
    );
    if (invalid) {
      Alert.alert(
        "Invalid hours",
        "For every open day, the closing time must be after the opening time."
      );
      return;
    }

    setSavingAvail(true);
    try {
      const slots: AvailabilitySlot[] = days
        .map((d, i) => ({ ...d, day_of_week: i }))
        .filter((d) => d.enabled)
        .map(({ day_of_week, open_time, close_time }) => ({
          day_of_week,
          open_time,
          close_time,
        }));
      await availabilityService.setAvailability(dbUser.id as number, slots);
      Alert.alert("Saved", "Your weekly availability has been updated.");
    } catch (err: any) {
      Alert.alert("Failed", err?.message ?? "Failed to save availability.");
    } finally {
      setSavingAvail(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(chef)/dashboard"))}
          hitSlop={10}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={styles.headerTitle}>Availability</Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Default prep time */}
          <Text style={styles.sectionTitle}>Default Preparation Time</Text>
          <Text style={styles.sectionHint}>
            Pre-fills the prep time on new menu items. You can override it for any
            specific dish.
          </Text>
          <View style={styles.prepRow}>
            <View style={styles.prepInputWrap}>
              <TextInput
                style={styles.prepInput}
                value={defaultPrepTime}
                onChangeText={setDefaultPrepTime}
                placeholder="e.g. 1.5"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="decimal-pad"
                returnKeyType="done"
              />
              <Text style={styles.prepUnit}>hours</Text>
            </View>
            <Button onPress={saveDefaultPrepTime} loading={savingPrep} style={styles.prepSaveBtn}>
              Save
            </Button>
          </View>

          {/* Weekly availability */}
          <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>
            Weekly Availability
          </Text>

          {/* Visual week summary */}
          <View style={styles.weekSummary}>
            {DAY_LETTERS.map((label, i) => (
              <View
                key={i}
                style={[
                  styles.weekPill,
                  days[i].enabled ? styles.weekPillOn : styles.weekPillOff,
                ]}
              >
                <Text
                  style={[
                    styles.weekPillText,
                    days[i].enabled
                      ? styles.weekPillTextOn
                      : styles.weekPillTextOff,
                  ]}
                >
                  {label}
                </Text>
              </View>
            ))}
          </View>

          {/* Bulk shortcuts */}
          <View style={styles.shortcuts}>
            <Pressable style={styles.shortcutBtn} onPress={applyMondayToWeekdays}>
              <Ionicons name="copy-outline" size={14} color={colors.primary} />
              <Text style={styles.shortcutText}>Monday → weekdays</Text>
            </Pressable>
            <Pressable style={styles.shortcutBtn} onPress={applyToAllDays}>
              <Ionicons name="albums-outline" size={14} color={colors.primary} />
              <Text style={styles.shortcutText}>Apply to all days</Text>
            </Pressable>
          </View>

          {/* Per-day rows */}
          <View style={styles.dayList}>
            {DAYS_FULL.map((day, i) => (
              <View key={day} style={styles.dayRow}>
                <View style={styles.dayHeader}>
                  <Switch
                    value={days[i].enabled}
                    onValueChange={(v) => updateDay(i, { enabled: v })}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor="#fff"
                  />
                  <Text style={styles.dayName}>{day}</Text>
                </View>

                {days[i].enabled ? (
                  <View style={styles.timeRow}>
                    <Pressable
                      style={styles.timeChip}
                      onPress={() => setPicker({ dayIndex: i, field: "open_time" })}
                    >
                      <Ionicons
                        name="time-outline"
                        size={14}
                        color={colors.foreground}
                      />
                      <Text style={styles.timeChipText}>
                        {displayTime(days[i].open_time)}
                      </Text>
                    </Pressable>
                    <Ionicons
                      name="arrow-forward"
                      size={14}
                      color={colors.mutedForeground}
                    />
                    <Pressable
                      style={styles.timeChip}
                      onPress={() => setPicker({ dayIndex: i, field: "close_time" })}
                    >
                      <Ionicons
                        name="time-outline"
                        size={14}
                        color={colors.foreground}
                      />
                      <Text style={styles.timeChipText}>
                        {displayTime(days[i].close_time)}
                      </Text>
                    </Pressable>
                  </View>
                ) : (
                  <Text style={styles.closedText}>Closed</Text>
                )}
              </View>
            ))}
          </View>

          <Button
            onPress={saveAvailability}
            loading={savingAvail}
            style={styles.saveBtn}
          >
            Save Availability
          </Button>
        </ScrollView>
      )}

      {/* Android time picker (native, self-dismissing) */}
      {picker && Platform.OS === "android" && (
        <DateTimePicker
          value={hhmmToDate(days[picker.dayIndex][picker.field])}
          mode="time"
          display="default"
          onChange={onPickerChange}
        />
      )}

      {/* iOS time picker (inline spinner in a bottom modal) */}
      {picker && Platform.OS === "ios" && (
        <Modal transparent animationType="slide" visible>
          <Pressable style={styles.modalBackdrop} onPress={() => setPicker(null)}>
            <Pressable style={styles.iosPicker} onPress={(e) => e.stopPropagation()}>
              <View style={styles.iosPickerHeader}>
                <Text style={styles.iosPickerTitle}>
                  {DAYS_FULL[picker.dayIndex]} ·{" "}
                  {picker.field === "open_time" ? "Opens" : "Closes"}
                </Text>
                <Pressable onPress={() => setPicker(null)} hitSlop={8}>
                  <Text style={styles.iosPickerDone}>Done</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={hhmmToDate(days[picker.dayIndex][picker.field])}
                mode="time"
                display="spinner"
                onChange={onPickerChange}
              />
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { width: 40, height: 24, justifyContent: "center" },
  headerTitle: {
    ...typography.lg,
    fontFamily: fonts.sansBold,
    fontWeight: "700",
    color: colors.foreground,
  },

  content: { padding: spacing.md, paddingBottom: spacing["2xl"] },

  sectionTitle: {
    ...typography.xl,
    fontFamily: fonts.displaySemiBold,
    fontWeight: "700",
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  sectionHint: {
    ...typography.sm,
    color: colors.mutedForeground,
    marginBottom: spacing.md,
  },

  prepRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  prepInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.card,
  },
  prepInput: {
    flex: 1,
    ...typography.base,
    color: colors.foreground,
    paddingVertical: spacing.sm,
  },
  prepUnit: { ...typography.sm, color: colors.mutedForeground },
  prepSaveBtn: { minWidth: 88 },

  weekSummary: { flexDirection: "row", gap: spacing.xs, marginBottom: spacing.md },
  weekPill: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  weekPillOn: {
    backgroundColor: colors.lightSage,
    borderColor: colors.success,
  },
  weekPillOff: {
    backgroundColor: colors.muted,
    borderColor: colors.border,
  },
  weekPillText: { ...typography.xs, fontWeight: "700" },
  weekPillTextOn: { color: colors.success },
  weekPillTextOff: { color: colors.mutedForeground },

  shortcuts: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.lg },
  shortcutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shortcutText: { ...typography.sm, color: colors.primary, fontWeight: "600" },

  dayList: { gap: spacing.sm, marginBottom: spacing.lg },
  dayRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: 52,
  },
  dayHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  dayName: {
    ...typography.base,
    fontWeight: "600",
    color: colors.foreground,
  },
  timeRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  timeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  timeChipText: { ...typography.sm, color: colors.foreground, fontWeight: "600" },
  closedText: { ...typography.sm, color: colors.mutedForeground },

  saveBtn: { marginTop: spacing.sm },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  iosPicker: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingBottom: spacing.xl,
  },
  iosPickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iosPickerTitle: {
    ...typography.base,
    fontWeight: "700",
    color: colors.foreground,
  },
  iosPickerDone: {
    ...typography.base,
    color: colors.primary,
    fontWeight: "700",
  },
});
