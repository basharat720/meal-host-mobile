import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, fonts, radius, spacing, typography } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { LocateFailure, useDeliveryLocation } from "@/contexts/DeliveryLocationContext";
import {
  ADDRESS_IN_USE,
  PRIMARY_ADDRESS,
  SavedAddress,
  addressTitle,
} from "@/services/addressService";
import { ApiError } from "@/lib/api";
import { getUserFriendlyError } from "@/lib/errorMessages";
import { useToast } from "@/components/ui/Toast";
import { PickedPlace, PlaceSearchInput } from "./PlaceSearchInput";
import { LocateMeButton, LocateTrouble } from "./LocateTrouble";

/**
 * The sheet the location pill opens: search, Locate me, saved addresses (pick,
 * edit, delete) and "Add new address". Mounted once, by
 * DeliveryLocationProvider, so checkout can open it too. Mirrors
 * meal-host-frontend/src/components/location/HeaderLocationPicker.tsx; see
 * feature-docs/12-delivery-address-in-the-app.md.
 */

const labelIcon = (label?: string | null): keyof typeof Ionicons.glyphMap =>
  label === "Home" ? "home-outline" : label === "Work" ? "briefcase-outline" : "location-outline";

export function LocationPickerSheet() {
  const insets = useSafeAreaInsets();
  const { dbUser } = useAuth();
  const { showToast } = useToast();
  const {
    location,
    savedAddresses,
    isLoadingAddresses,
    pickerOpen,
    setPickerOpen,
    selectAddress,
    locateMe,
    isLocating,
    openAddressMap,
    deleteAddress,
  } = useDeliveryLocation();

  const [picked, setPicked] = useState<PickedPlace | null>(null);
  const [trouble, setTrouble] = useState<LocateFailure | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  // Remounts the search box each time the sheet opens, so it starts empty.
  const [openCount, setOpenCount] = useState(0);

  const signedIn = !!dbUser;

  useEffect(() => {
    if (!pickerOpen) return;
    setTrouble(null);
    setPicked(null);
    setOpenCount((n) => n + 1);
  }, [pickerOpen]);

  const close = () => setPickerOpen(false);

  const handleLocate = async () => {
    setTrouble(null);
    const result = await locateMe();
    if (result.latitude != null && result.longitude != null) {
      // Approximate fixes open the map too, so the pin can be moved.
      openAddressMap({ center: { latitude: result.latitude, longitude: result.longitude } });
    } else {
      setTrouble(result.failure ?? "unavailable");
    }
  };

  const handlePick = (place: PickedPlace) => {
    setPicked(place);
    openAddressMap({
      center: { latitude: place.lat, longitude: place.lon },
      query: place.label,
    });
  };

  const runDelete = async (address: SavedAddress) => {
    setDeletingId(address.id);
    try {
      await deleteAddress(address.id);
      showToast({ message: "Address deleted" });
    } catch (error) {
      // The server's own explanation (profile address, in use by a dish or
      // request) is already customer-facing.
      const message =
        error instanceof ApiError &&
        (error.code === PRIMARY_ADDRESS || error.code === ADDRESS_IN_USE || error.status < 500)
          ? error.message
          : getUserFriendlyError(error, "Could not delete this address");
      Alert.alert("Could not delete this address", message);
    } finally {
      setDeletingId(null);
    }
  };

  const confirmDelete = (address: SavedAddress) => {
    Alert.alert(
      "Delete this address?",
      `${address.label ? `${address.label}: ` : ""}${addressTitle(address)}`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => void runDelete(address) },
      ]
    );
  };

  return (
    <Modal
      visible={pickerOpen}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={close}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Close" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.sm }]}>
          <View style={styles.handle} />
          <View style={styles.titleRow}>
            <Text style={styles.title}>Where should we deliver?</Text>
            <Pressable onPress={close} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={colors.foreground} />
            </Pressable>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.searchBlock}>
              <View style={styles.searchRow}>
                <PlaceSearchInput
                  key={`picker-search-${openCount}`}
                  onPick={handlePick}
                  containerStyle={styles.flex}
                  trailing={
                    <LocateMeButton onPress={() => void handleLocate()} isLocating={isLocating} />
                  }
                />
                <Pressable
                  style={({ pressed }) => [styles.mapButton, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Open the map"
                  onPress={() =>
                    openAddressMap(
                      picked
                        ? {
                            center: { latitude: picked.lat, longitude: picked.lon },
                            query: picked.label,
                          }
                        : {}
                    )
                  }
                >
                  <Ionicons name="arrow-forward" size={20} color={colors.primaryForeground} />
                </Pressable>
              </View>
              <LocateTrouble failure={trouble} />
            </View>

            {signedIn ? (
              <View style={styles.savedBlock}>
                <Text style={styles.sectionTitle}>Saved addresses</Text>

                {location && location.source !== "saved" && (
                  <View style={[styles.row, styles.rowSelected]}>
                    <Ionicons name="location-outline" size={20} color={colors.mutedForeground} />
                    <View style={styles.rowText}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {location.title}
                      </Text>
                      <Text style={styles.rowSub}>Current location — not saved</Text>
                    </View>
                    <Pressable
                      style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}
                      onPress={() =>
                        openAddressMap({
                          center: { latitude: location.latitude, longitude: location.longitude },
                        })
                      }
                    >
                      <Text style={styles.saveButtonText}>Save</Text>
                    </Pressable>
                  </View>
                )}

                {isLoadingAddresses && savedAddresses.length === 0 ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator size="small" color={colors.mutedForeground} />
                    <Text style={styles.muted}>Loading your addresses...</Text>
                  </View>
                ) : savedAddresses.length === 0 ? (
                  <Text style={[styles.muted, styles.padded]}>No saved addresses yet.</Text>
                ) : (
                  savedAddresses.map((a) => {
                    const selected = location?.addressId === a.id;
                    const title = addressTitle(a);
                    const sub = a.label
                      ? `${title}${a.address && title !== a.address ? ` · ${a.address}` : ""}`
                      : a.address;
                    return (
                      <View key={a.id} style={[styles.row, selected && styles.rowSelected]}>
                        <Pressable
                          style={styles.rowMain}
                          onPress={() => {
                            selectAddress(a);
                            close();
                          }}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                        >
                          <Ionicons name={labelIcon(a.label)} size={20} color={colors.mutedForeground} />
                          <View style={styles.rowText}>
                            <View style={styles.rowTitleLine}>
                              <Text style={[styles.rowTitle, styles.flexShrink]} numberOfLines={1}>
                                {a.label || title}
                              </Text>
                              {a.is_primary && (
                                <View style={styles.badge}>
                                  <Text style={styles.badgeText}>PROFILE</Text>
                                </View>
                              )}
                            </View>
                            {!!sub && (
                              <Text style={styles.rowSub} numberOfLines={1}>
                                {sub}
                              </Text>
                            )}
                          </View>
                          {selected && (
                            <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                          )}
                        </Pressable>
                        <Pressable
                          hitSlop={6}
                          style={styles.iconButton}
                          accessibilityRole="button"
                          accessibilityLabel="Edit address"
                          onPress={() => openAddressMap({ editing: a })}
                        >
                          <Ionicons name="pencil" size={16} color={colors.mutedForeground} />
                        </Pressable>
                        <Pressable
                          hitSlop={6}
                          style={styles.iconButton}
                          accessibilityRole="button"
                          accessibilityLabel="Delete address"
                          disabled={deletingId === a.id}
                          onPress={() => confirmDelete(a)}
                        >
                          {deletingId === a.id ? (
                            <ActivityIndicator size="small" color={colors.destructive} />
                          ) : (
                            <Ionicons name="trash-outline" size={16} color={colors.mutedForeground} />
                          )}
                        </Pressable>
                      </View>
                    );
                  })
                )}

                <Pressable
                  style={({ pressed }) => [styles.addRow, pressed && styles.pressed]}
                  onPress={() => openAddressMap({})}
                  accessibilityRole="button"
                >
                  <Ionicons name="add" size={20} color={colors.primary} />
                  <Text style={styles.addText}>Add new address</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.signInBlock}>
                <Text style={styles.muted}>
                  <Text
                    style={styles.link}
                    onPress={() => {
                      close();
                      router.push("/(auth)/customer-login");
                    }}
                  >
                    Sign in
                  </Text>{" "}
                  to save your addresses.
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    maxHeight: "88%",
    backgroundColor: colors.background,
    borderTopLeftRadius: radius["2xl"],
    borderTopRightRadius: radius["2xl"],
    paddingTop: spacing.sm,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: {
    flex: 1,
    ...typography.lg,
    fontFamily: fonts.sansBold,
    fontWeight: "700",
    color: colors.foreground,
  },
  scrollContent: { paddingBottom: spacing.md },
  searchBlock: { paddingHorizontal: spacing.md, gap: spacing.sm, paddingBottom: spacing.md },
  searchRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  mapButton: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.8 },
  savedBlock: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  sectionTitle: {
    ...typography.md,
    fontFamily: fonts.sansBold,
    fontWeight: "700",
    color: colors.foreground,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  rowSelected: { backgroundColor: colors.muted },
  rowMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.md },
  rowText: { flex: 1, minWidth: 0 },
  rowTitleLine: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  rowTitle: {
    ...typography.sm,
    fontFamily: fonts.sansSemiBold,
    fontWeight: "600",
    color: colors.foreground,
  },
  rowSub: { ...typography.sm, color: colors.mutedForeground },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: fonts.sansMedium,
    fontWeight: "500",
    color: colors.mutedForeground,
  },
  iconButton: { padding: 6 },
  saveButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  saveButtonText: {
    ...typography.sm,
    fontFamily: fonts.sansSemiBold,
    fontWeight: "600",
    color: colors.primary,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  muted: { ...typography.sm, color: colors.mutedForeground },
  padded: { paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  addText: {
    ...typography.sm,
    fontFamily: fonts.sansSemiBold,
    fontWeight: "600",
    color: colors.primary,
  },
  signInBlock: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  link: { fontFamily: fonts.sansSemiBold, fontWeight: "600", color: colors.primary },
});
