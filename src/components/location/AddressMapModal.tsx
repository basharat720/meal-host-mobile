import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { KeyboardAvoidingView, KeyboardAwareScrollView } from "react-native-keyboard-controller";
import MapView, { PROVIDER_GOOGLE, Region } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { colors, fonts, radius, shadow, spacing, typography } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import {
  AddressMapRequest,
  LocateFailure,
  UNNAMED_PIN,
  useDeliveryLocation,
} from "@/contexts/DeliveryLocationContext";
import { DEFAULT_MAP_CENTER, nameForPoint, shortTitle } from "@/lib/googlePlaces";
import { ApiError } from "@/lib/api";
import { getUserFriendlyError } from "@/lib/errorMessages";
import { GOOGLE_MAPS_API_KEY } from "@/constants/config";
import { PlaceSearchInput } from "./PlaceSearchInput";
import { LocateMeButton, LocateTrouble } from "./LocateTrouble";

/**
 * foodpanda's two-step "add address" screen, as on the website.
 *
 * Step 1 — "What's your exact location?": a map with a pin fixed in the
 * middle. You move the map, not the pin. A signed-out visitor stops here: the
 * pin becomes their location. Step 2 (signed in only) asks for what a rider
 * needs and saves the address to the account.
 *
 * The pin is turned into an address once, when the button is pressed, never
 * while dragging — that lookup is the billed call. Apple Maps on iPhone (no
 * key, no bill), Google Maps on Android. Mirrors meal-host-frontend/src/
 * components/location/AddressMapDialog.tsx; see
 * feature-docs/12-delivery-address-in-the-app.md.
 */

type LabelChoice = "Home" | "Work" | "Other";

interface DetailsForm {
  address: string;
  houseNumber: string;
  street: string;
  buildingFloor: string;
  instructions: string;
  labelChoice: LabelChoice;
  customLabel: string;
}

const emptyDetails: DetailsForm = {
  address: "",
  houseNumber: "",
  street: "",
  buildingFloor: "",
  instructions: "",
  labelChoice: "Home",
  customLabel: "",
};

const labelChoiceOf = (
  label?: string | null
): { labelChoice: LabelChoice; customLabel: string } => {
  if (!label || label === "Home") return { labelChoice: "Home", customLabel: "" };
  if (label === "Work") return { labelChoice: "Work", customLabel: "" };
  return { labelChoice: "Other", customLabel: label === "Other" ? "" : label };
};

const LABEL_ICONS: Record<LabelChoice, keyof typeof Ionicons.glyphMap> = {
  Home: "home-outline",
  Work: "briefcase-outline",
  Other: "location-outline",
};

type Point = { latitude: number; longitude: number };

/** Street-level: close enough to put the pin on the right door. */
const PIN_DELTA = 0.004;
const regionAt = (p: Point): Region => ({
  ...p,
  latitudeDelta: PIN_DELTA,
  longitudeDelta: PIN_DELTA,
});

/**
 * Android draws the map with Google's SDK, which can't start without a key;
 * iPhone uses Apple Maps and always can.
 */
const MAP_AVAILABLE = Platform.OS === "ios" || !!GOOGLE_MAPS_API_KEY;

interface AddressMapModalProps {
  /** Null while closed. */
  request: AddressMapRequest | null;
  onClose: () => void;
}

export function AddressMapModal({ request, onClose }: AddressMapModalProps) {
  const insets = useSafeAreaInsets();
  const { dbUser } = useAuth();
  const { showToast } = useToast();
  const { location, setPinnedLocation, saveAddress, locateMe, isLocating } =
    useDeliveryLocation();
  const mapRef = useRef<MapView>(null);

  const open = request !== null;
  const editing = request?.editing;
  const formMode = !!request?.onConfirm;
  const canSave = !!dbUser && !formMode;

  const [step, setStep] = useState<1 | 2>(1);
  const [center, setCenter] = useState<Point>(DEFAULT_MAP_CENTER);
  const [startCenter, setStartCenter] = useState<Point>(DEFAULT_MAP_CENTER);
  const [details, setDetails] = useState<DetailsForm>(emptyDetails);
  const [isResolving, setIsResolving] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [trouble, setTrouble] = useState<LocateFailure | null>(null);
  // Without a map, the button needs a position from somewhere first.
  const [hasPosition, setHasPosition] = useState(false);
  // Remounts the search box on every open, so it starts from request.query.
  const [openCount, setOpenCount] = useState(0);

  // Fresh state every time the screen opens.
  useEffect(() => {
    if (!request) return;
    const start: Point =
      request.center ??
      (request.editing
        ? { latitude: request.editing.latitude, longitude: request.editing.longitude }
        : location
          ? { latitude: location.latitude, longitude: location.longitude }
          : DEFAULT_MAP_CENTER);
    setOpenCount((n) => n + 1);
    setStartCenter(start);
    setCenter(start);
    setHasPosition(!!request.center || !!request.editing || !!location);
    setStep(1);
    setShowErrors(false);
    setTrouble(null);
    setDetails(
      request.editing
        ? {
            address: request.editing.address ?? "",
            houseNumber: request.editing.house_number ?? "",
            street: request.editing.street ?? "",
            buildingFloor: request.editing.building_floor ?? "",
            instructions: request.editing.delivery_instructions ?? "",
            ...labelChoiceOf(request.editing.label),
          }
        : emptyDetails
    );
    // Only on open — not when the selection changes underneath.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  const moveTo = (pos: Point) => {
    setCenter(pos);
    setHasPosition(true);
    mapRef.current?.animateToRegion(regionAt(pos), 400);
  };

  const handleLocate = async () => {
    setTrouble(null);
    const result = await locateMe();
    if (result.latitude != null && result.longitude != null) {
      moveTo({ latitude: result.latitude, longitude: result.longitude });
      if (!result.ok) setTrouble("imprecise");
    } else {
      setTrouble(result.failure ?? "unavailable");
    }
  };

  /** Step 1's button: look the pin up once, then finish (guest/form) or go on. */
  const handleConfirmPin = async () => {
    if (!request) return;
    setIsResolving(true);
    const found = await nameForPoint(center.latitude, center.longitude);
    setIsResolving(false);
    const address = found?.address ?? UNNAMED_PIN;

    if (request.onConfirm) {
      request.onConfirm({ latitude: center.latitude, longitude: center.longitude, address });
      onClose();
      return;
    }

    if (!canSave) {
      setPinnedLocation({
        latitude: center.latitude,
        longitude: center.longitude,
        title: shortTitle(address),
        address,
      });
      onClose();
      return;
    }

    setDetails((d) => ({
      ...d,
      address,
      street: d.street || found?.street || "",
      houseNumber: d.houseNumber || found?.houseNumber || "",
    }));
    setStep(2);
  };

  const handleSave = async () => {
    setShowErrors(true);
    if (!details.houseNumber.trim()) return;
    if (details.labelChoice === "Other" && !details.customLabel.trim()) return;
    setIsSaving(true);
    try {
      await saveAddress(
        {
          latitude: center.latitude,
          longitude: center.longitude,
          address: details.address,
          label:
            details.labelChoice === "Other" ? details.customLabel.trim() : details.labelChoice,
          house_number: details.houseNumber.trim(),
          street: details.street.trim(),
          building_floor: details.buildingFloor.trim(),
          delivery_instructions: details.instructions.trim(),
        },
        editing?.id
      );
      onClose();
      showToast({ message: editing ? "Address updated" : "Address saved" });
    } catch (error) {
      Alert.alert(
        "Could not save this address",
        error instanceof ApiError
          ? error.message
          : getUserFriendlyError(error, "Please try again.")
      );
    } finally {
      setIsSaving(false);
    }
  };

  // The map remounts on the way back, so start it where the pin was left.
  const backToMap = () => {
    setStartCenter(center);
    setStep(1);
  };

  const set = <K extends keyof DetailsForm>(key: K, value: DetailsForm[K]) =>
    setDetails((d) => ({ ...d, [key]: value }));

  const houseMissing = showErrors && !details.houseNumber.trim();
  const customLabelMissing =
    showErrors && details.labelChoice === "Other" && !details.customLabel.trim();

  return (
    <Modal
      visible={open}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={step === 2 ? backToMap : onClose}
    >
      <KeyboardAvoidingView
        style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
        behavior="padding"
      >
        {step === 1 ? (
          <>
            <View style={styles.header}>
              <View style={styles.titleRow}>
                <Ionicons name="location-outline" size={20} color={colors.mutedForeground} />
                <Text style={styles.title}>What's your exact location?</Text>
                <Pressable
                  onPress={onClose}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                >
                  <Ionicons name="close" size={24} color={colors.foreground} />
                </Pressable>
              </View>
              <Text style={styles.description}>
                Providing your location enables more accurate search and delivery ETA, seamless
                order tracking and personalised recommendations.
              </Text>
            </View>

            <View style={styles.searchBlock}>
              <PlaceSearchInput
                key={`map-search-${openCount}`}
                label="Enter your address"
                initialQuery={request?.query ?? ""}
                onPick={(place) => moveTo({ latitude: place.lat, longitude: place.lon })}
                trailing={
                  <LocateMeButton onPress={() => void handleLocate()} isLocating={isLocating} />
                }
              />
              {trouble === "imprecise" ? (
                <Text style={styles.note}>
                  We could only find you approximately. Move the map so the pin sits on your door.
                </Text>
              ) : (
                <LocateTrouble failure={trouble} />
              )}
            </View>

            <View style={styles.mapWrap}>
              {MAP_AVAILABLE ? (
                <>
                  <MapView
                    // Remount when going back from step 2, so it opens on the pin.
                    key={`${startCenter.latitude},${startCenter.longitude}`}
                    ref={mapRef}
                    style={StyleSheet.absoluteFill}
                    provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
                    initialRegion={regionAt(startCenter)}
                    onRegionChangeComplete={(region) =>
                      setCenter({ latitude: region.latitude, longitude: region.longitude })
                    }
                    showsUserLocation={false}
                    showsPointsOfInterest={false}
                    toolbarEnabled={false}
                    rotateEnabled={false}
                    pitchEnabled={false}
                  />
                  {/* The pin stays put; the map moves under it. */}
                  <View pointerEvents="none" style={styles.pinLayer}>
                    <View style={styles.pinAnchor}>
                      <View style={styles.pinStack}>
                        <View style={styles.pinLabel}>
                          <Text style={styles.pinLabelText} numberOfLines={1}>
                            {request?.pinLabel ?? "We'll deliver here"}
                          </Text>
                        </View>
                        <Ionicons name="location-sharp" size={40} color={colors.primary} />
                      </View>
                    </View>
                  </View>
                </>
              ) : (
                <View style={styles.noMap}>
                  <Ionicons name="map-outline" size={32} color={colors.mutedForeground} />
                  <Text style={styles.noMapText}>The map isn't available right now.</Text>
                  <Text style={styles.noMapText}>
                    Use <Text style={styles.bold}>Locate me</Text> or search above, then confirm.
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.footer}>
              <Button
                size="lg"
                onPress={() => void handleConfirmPin()}
                loading={isResolving}
                disabled={!MAP_AVAILABLE && !hasPosition}
              >
                {formMode ? "Use this location" : canSave ? "Confirm location" : "Find chefs"}
              </Button>
            </View>
          </>
        ) : (
          <>
            <View style={styles.header}>
              <View style={styles.titleRow}>
                <Pressable
                  onPress={backToMap}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Back to the map"
                >
                  <Ionicons name="arrow-back" size={22} color={colors.foreground} />
                </Pressable>
                <Text style={styles.title}>{editing ? "Edit address" : "Address details"}</Text>
                <Pressable
                  onPress={onClose}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                >
                  <Ionicons name="close" size={24} color={colors.foreground} />
                </Pressable>
              </View>
              <Text style={styles.description}>Help your rider find the door.</Text>
            </View>

            <KeyboardAwareScrollView
              bottomOffset={24}
              style={styles.flex}
              contentContainerStyle={styles.form}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.addressCard}>
                <Ionicons name="location" size={20} color={colors.primary} />
                <Text style={styles.addressCardText}>{details.address}</Text>
                <Pressable onPress={backToMap} hitSlop={8} accessibilityRole="button">
                  <Text style={styles.link}>Change</Text>
                </Pressable>
              </View>

              <Input
                label="House / flat number *"
                value={details.houseNumber}
                maxLength={60}
                autoFocus={!editing}
                onChangeText={(v) => set("houseNumber", v)}
                placeholder="e.g. House 12"
                error={houseMissing ? "Enter a house or flat number." : undefined}
              />
              <Input
                label="Street"
                value={details.street}
                maxLength={160}
                onChangeText={(v) => set("street", v)}
                placeholder="e.g. Street 7"
              />
              <Input
                label="Building / floor (optional)"
                value={details.buildingFloor}
                maxLength={120}
                onChangeText={(v) => set("buildingFloor", v)}
                placeholder="e.g. Block B, 2nd floor"
              />
              <Input
                label="Note to rider (optional)"
                value={details.instructions}
                maxLength={300}
                multiline
                numberOfLines={2}
                onChangeText={(v) => set("instructions", v)}
                placeholder="e.g. Green gate, ring twice"
                style={styles.textArea}
              />

              <View style={styles.labelBlock}>
                <Text style={styles.fieldLabel}>Label</Text>
                <View style={styles.chips}>
                  {(["Home", "Work", "Other"] as const).map((value) => {
                    const active = details.labelChoice === value;
                    return (
                      <Pressable
                        key={value}
                        onPress={() => set("labelChoice", value)}
                        style={[styles.chip, active && styles.chipActive]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                      >
                        <Ionicons
                          name={LABEL_ICONS[value]}
                          size={16}
                          color={active ? colors.primary : colors.foreground}
                        />
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {value}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {details.labelChoice === "Other" && (
                  <Input
                    value={details.customLabel}
                    maxLength={40}
                    onChangeText={(v) => set("customLabel", v)}
                    placeholder="e.g. Ammi's house"
                    error={customLabelMissing ? "Give this address a name." : undefined}
                  />
                )}
              </View>
            </KeyboardAwareScrollView>

            <View style={styles.footer}>
              <Button size="lg" onPress={() => void handleSave()} loading={isSaving}>
                Save address
              </Button>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: {
    flex: 1,
    ...typography.lg,
    fontFamily: fonts.sansBold,
    fontWeight: "700",
    color: colors.foreground,
  },
  description: { ...typography.sm, color: colors.mutedForeground },
  searchBlock: { paddingHorizontal: spacing.md, gap: spacing.sm, zIndex: 2 },
  note: {
    ...typography.sm,
    color: colors.foreground,
    backgroundColor: colors.muted,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  mapWrap: {
    flex: 1,
    margin: spacing.md,
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.muted,
    minHeight: 220,
  },
  pinLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  // A zero-height box at the exact centre; the pin hangs off it so its tip,
  // not its middle, marks the point.
  pinAnchor: { width: 0, height: 0, alignItems: "center", overflow: "visible" },
  pinStack: { position: "absolute", bottom: -4, width: 260, alignItems: "center" },
  pinLabel: {
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.foreground,
    ...shadow.lg,
  },
  pinLabelText: {
    ...typography.sm,
    fontFamily: fonts.sansMedium,
    fontWeight: "500",
    color: colors.white,
  },
  noMap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.lg,
  },
  noMapText: { ...typography.sm, color: colors.mutedForeground, textAlign: "center" },
  bold: { fontFamily: fonts.sansSemiBold, fontWeight: "600" },
  footer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  form: { padding: spacing.md, gap: spacing.md },
  addressCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  addressCardText: { flex: 1, ...typography.sm, color: colors.foreground },
  link: {
    ...typography.sm,
    fontFamily: fonts.sansSemiBold,
    fontWeight: "600",
    color: colors.primary,
  },
  textArea: { minHeight: 64, textAlignVertical: "top" },
  labelBlock: { gap: spacing.sm },
  fieldLabel: {
    ...typography.sm,
    fontFamily: fonts.sansSemiBold,
    fontWeight: "600",
    color: colors.foreground,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primarySubtle },
  chipText: {
    ...typography.sm,
    fontFamily: fonts.sansMedium,
    fontWeight: "500",
    color: colors.foreground,
  },
  chipTextActive: { color: colors.primary },
});
