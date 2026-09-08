import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  FlatList,
  StyleSheet,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { type CountryCode } from "libphonenumber-js";
import {
  PHONE_COUNTRIES,
  PhoneCountry,
  composeE164,
  formatNationalAsYouType,
  matchesCountry,
  splitE164,
  DEFAULT_PHONE_COUNTRY,
} from "@/lib/phone";
import { colors, fonts, radius, spacing, typography } from "@/constants/theme";

interface PhoneInputProps {
  label?: string;
  error?: string;
  /** E.164 value, e.g. "+923001234567". Empty string is treated as no value. */
  value?: string;
  /** Always receives an E.164 string, or "" when the field is cleared. */
  onChangeText: (value: string) => void;
  placeholder?: string;
  containerStyle?: ViewStyle;
  editable?: boolean;
}

function CountryRow({
  country,
  selected,
  onPress,
}: {
  country: PhoneCountry;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.countryRow, pressed && styles.countryRowPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text style={styles.flag}>{country.flag}</Text>
      <Text style={styles.countryName} numberOfLines={1}>
        {country.name}
      </Text>
      <Text style={styles.countryCode}>+{country.callingCode}</Text>
      {selected ? (
        <Ionicons name="checkmark" size={18} color={colors.primary} />
      ) : (
        <View style={styles.checkPlaceholder} />
      )}
    </Pressable>
  );
}

/**
 * Phone field with a country-code picker. Emits E.164 so every phone number
 * the app stores has the same shape. See feature-docs/11-phone-number-entry.md.
 *
 * The web field is built on react-phone-number-input, which is DOM-only, so
 * this is a native reimplementation of the same behaviour: pick a country,
 * type the national number, store E.164.
 */
export const PhoneInput = ({
  label,
  error,
  value,
  onChangeText,
  placeholder = "300 1234567",
  containerStyle,
  editable = true,
}: PhoneInputProps) => {
  // The country and the national digits are the field's own state, not
  // derived from `value` on every keystroke. An incomplete number can't be
  // split back into (country, digits) reliably — libphonenumber can't tell
  // where the dial code ends — so re-deriving would fold the dial code into
  // the digits and duplicate it with each character typed.
  const [country, setCountry] = useState<CountryCode>(() => splitE164(value).country);
  const [digits, setDigits] = useState(() => splitE164(value).nationalDigits);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");

  // What we last handed to onChangeText, so a `value` we caused ourselves is
  // not mistaken for the parent replacing it.
  const emitted = useRef(composeE164(splitE164(value).country, splitE164(value).nationalDigits));

  // Adopt `value` only when it changes from the outside — a profile load
  // finishing, or a form reset. Own edits are already reflected in state.
  useEffect(() => {
    const incoming = value ?? "";
    if (incoming === emitted.current) return;
    const next = splitE164(incoming);
    setCountry(next.country);
    setDigits(next.nationalDigits);
    emitted.current = incoming;
  }, [value]);

  const emit = (nextCountry: CountryCode, nextDigits: string) => {
    const next = composeE164(nextCountry, nextDigits);
    emitted.current = next;
    onChangeText(next);
  };

  const activeCountry =
    PHONE_COUNTRIES.find((c) => c.code === country) ??
    PHONE_COUNTRIES.find((c) => c.code === DEFAULT_PHONE_COUNTRY)!;

  const display = formatNationalAsYouType(digits, country);

  const results = useMemo(
    () => PHONE_COUNTRIES.filter((c) => matchesCountry(c, search)),
    [search]
  );

  const handleDigits = (text: string) => {
    // Keep only digits: the visible text is a formatted view of them, so
    // grouping characters must not survive into the stored value.
    const next = text.replace(/\D/g, "");
    setDigits(next);
    emit(country, next);
  };

  const handleCountry = (next: CountryCode) => {
    setCountry(next);
    setPickerOpen(false);
    setSearch("");
    // Keep the digits already typed; only the dial code changes.
    emit(next, digits);
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}

      <View style={[styles.field, !!error && styles.fieldError]}>
        <Pressable
          style={styles.countryButton}
          onPress={() => editable && setPickerOpen(true)}
          disabled={!editable}
          accessibilityRole="button"
          accessibilityLabel="Select country calling code"
        >
          <Text style={styles.flag}>{activeCountry.flag}</Text>
          <Text style={styles.dialCode}>+{activeCountry.callingCode}</Text>
          <Ionicons name="chevron-down" size={14} color={colors.mutedForeground} />
        </Pressable>

        <View style={styles.divider} />

        <TextInput
          style={styles.input}
          value={display}
          onChangeText={handleDigits}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          editable={editable}
        />
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <Modal
        visible={pickerOpen}
        animationType="slide"
        onRequestClose={() => setPickerOpen(false)}
        presentationStyle="pageSheet"
      >
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Select country</Text>
            <Pressable
              onPress={() => setPickerOpen(false)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={24} color={colors.foreground} />
            </Pressable>
          </View>

          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={18} color={colors.mutedForeground} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search country or code..."
              placeholderTextColor={colors.mutedForeground}
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>

          <FlatList
            data={results}
            keyExtractor={(item) => item.code}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <CountryRow
                country={item}
                selected={item.code === country}
                onPress={() => handleCountry(item.code)}
              />
            )}
            ListEmptyComponent={<Text style={styles.empty}>No country found.</Text>}
          />
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 6 },
  label: {
    ...typography.sm,
    fontFamily: fonts.sansSemiBold,
    fontWeight: "600",
    color: colors.foreground,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  fieldError: { borderColor: colors.destructive },
  countryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 11,
  },
  divider: { width: 1, alignSelf: "stretch", backgroundColor: colors.border },
  dialCode: {
    ...typography.base,
    fontFamily: fonts.sans,
    color: colors.foreground,
    fontVariant: ["tabular-nums"],
  },
  input: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    ...typography.base,
    fontFamily: fonts.sans,
    color: colors.foreground,
  },
  error: { ...typography.xs, color: colors.destructive },

  sheet: { flex: 1, backgroundColor: colors.background },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetTitle: {
    ...typography.lg,
    fontFamily: fonts.sansBold,
    fontWeight: "700",
    color: colors.foreground,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    margin: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    ...typography.base,
    fontFamily: fonts.sans,
    color: colors.foreground,
  },
  countryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  countryRowPressed: { backgroundColor: colors.muted },
  flag: { fontSize: 20 },
  countryName: { flex: 1, ...typography.base, color: colors.foreground },
  countryCode: {
    ...typography.base,
    color: colors.mutedForeground,
    fontVariant: ["tabular-nums"],
  },
  checkPlaceholder: { width: 18 },
  empty: {
    ...typography.base,
    color: colors.mutedForeground,
    textAlign: "center",
    padding: spacing.lg,
  },
});
