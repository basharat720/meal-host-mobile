import React, { useCallback, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Modal,
  ScrollView,
  Alert,
  Pressable,
  Switch,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/i18n/context";
import { menuService } from "@/services/menuService";
import { cuisineService } from "@/services/cuisineService";
import {
  DietaryTag,
  FoodListing,
  FoodListingCreate,
  FoodListingUpdate,
  CuisineType,
  UserLocationResponse,
} from "@/services/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { isChefActive } from "@/lib/chefStatus";
import { colors, radius, shadow, spacing, typography } from "@/constants/theme";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface DishForm {
  title: string;
  description: string;
  price: string;
  available_quantity: string;
  preparation_time_hours: string;
  dietary_tag_ids: number[];
  cuisine_type_ids: number[];
  pickup_location_id: number | null;
  imageUri: string | null;   // local URI from image picker
  imageUrl: string;          // remote URL (fallback / after upload)
  isAvailable: boolean;
}

// Prep time is entered/edited in HOURS (matching the availability screen) but
// stored in minutes. These convert between the two.
const prepHoursToMinutes = (hours: string): number | undefined => {
  const h = parseFloat(hours);
  return Number.isFinite(h) && h > 0 ? Math.round(h * 60) : undefined;
};
const prepMinutesToHours = (minutes?: number | null): string =>
  minutes != null ? (minutes / 60).toFixed(2).replace(/\.?0+$/, "") : "";

const EMPTY_FORM: DishForm = {
  title: "",
  description: "",
  price: "",
  available_quantity: "",
  preparation_time_hours: "",
  dietary_tag_ids: [],
  cuisine_type_ids: [],
  pickup_location_id: null,
  imageUri: null,
  imageUrl: "",
  isAvailable: true,
};

// ---------------------------------------------------------------------------
// Image upload helper (Cloudinary via env vars)
// ---------------------------------------------------------------------------
const CLOUDINARY_CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";
const CLOUDINARY_UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? "";

const uploadImageToCloudinary = async (
  uri: string,
  chefUid: string
): Promise<string> => {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    throw new Error(
      "Cloudinary not configured. Set EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME and EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET."
    );
  }
  const safeUid = chefUid.replace(/[^a-zA-Z0-9]/g, "_");
  const ext = uri.split(".").pop()?.toLowerCase() ?? "jpg";
  const mimeMap: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };
  const mimeType = mimeMap[ext] ?? "image/jpeg";

  const formData = new FormData();
  formData.append("file", { uri, name: `food.${ext}`, type: mimeType } as any);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", `food-images/${safeUid}`);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: "POST", body: formData }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Cloudinary upload failed (${res.status}): ${err?.error?.message ?? ""}`);
  }
  const data = await res.json();
  const url = data.secure_url || data.url;
  if (!url) throw new Error("Cloudinary response missing URL");
  return url as string;
};

// ---------------------------------------------------------------------------
// Dish row component
// ---------------------------------------------------------------------------
function DishRow({
  item,
  onToggle,
  onEdit,
  onDelete,
}: {
  item: FoodListing;
  onToggle: (id: number, current: FoodListing["status"]) => void;
  onEdit: (item: FoodListing) => void;
  onDelete: (id: number) => void;
}) {
  const { formatPrice } = useI18n();
  const primaryImage = item.images?.find((i) => i.is_primary)?.image_url ?? item.images?.[0]?.image_url ?? null;
  const isActive = item.status === "ACTIVE";

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => onEdit(item)}
        style={({ pressed }) => pressed && styles.rowImagePressed}
        accessibilityRole="button"
        accessibilityLabel={`Edit ${item.title}`}
      >
        {primaryImage ? (
          <Image source={{ uri: primaryImage }} style={styles.rowImage} contentFit="cover" />
        ) : (
          <View style={[styles.rowImage, styles.rowImageFallback]}>
            <Ionicons name="restaurant-outline" size={28} color={colors.mutedForeground} />
          </View>
        )}
        <View style={styles.rowImageEditBadge}>
          <Ionicons name="pencil" size={11} color={colors.primaryForeground} />
        </View>
      </Pressable>

      <View style={styles.rowInfo}>
        <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.rowPrice}>{formatPrice(item.price)}</Text>
        <Text style={styles.rowQty}>Qty: {item.available_quantity}</Text>
        {item.dietary_tags?.length > 0 && (
          <View style={styles.rowTags}>
            {item.dietary_tags.slice(0, 3).map((t) => (
              <Badge key={t.id} label={t.code} variant="outline" />
            ))}
          </View>
        )}
      </View>

      <View style={styles.rowActions}>
        <Switch
          value={isActive}
          onValueChange={() => onToggle(item.id, item.status)}
          trackColor={{ true: colors.primary, false: colors.border }}
          thumbColor={colors.surface}
        />
        <Pressable
          onPress={() => onDelete(item.id)}
          style={({ pressed }) => [styles.actionBtn, styles.deleteBtn, pressed && styles.actionBtnPressed]}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`Delete ${item.title}`}
        >
          <Ionicons name="trash" size={16} color={colors.destructive} />
        </Pressable>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Dish form modal
// ---------------------------------------------------------------------------
function DishModal({
  visible,
  form,
  setForm,
  dietaryTags,
  cuisineTypes,
  locations,
  saving,
  onClose,
  onSave,
  title,
}: {
  visible: boolean;
  form: DishForm;
  setForm: React.Dispatch<React.SetStateAction<DishForm>>;
  dietaryTags: DietaryTag[];
  cuisineTypes: CuisineType[];
  locations: UserLocationResponse[];
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  title: string;
}) {
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      setForm((f) => ({ ...f, imageUri: result.assets[0].uri }));
    }
  };

  const toggleTag = (tagId: number) => {
    setForm((f) => {
      const has = f.dietary_tag_ids.includes(tagId);
      return {
        ...f,
        dietary_tag_ids: has
          ? f.dietary_tag_ids.filter((id) => id !== tagId)
          : [...f.dietary_tag_ids, tagId],
      };
    });
  };

  const toggleCuisine = (cuisineId: number) => {
    setForm((f) => {
      const has = f.cuisine_type_ids.includes(cuisineId);
      return {
        ...f,
        cuisine_type_ids: has
          ? f.cuisine_type_ids.filter((id) => id !== cuisineId)
          : [...f.cuisine_type_ids, cuisineId],
      };
    });
  };

  const selectLocation = (locationId: number) => {
    setForm((f) => ({ ...f, pickup_location_id: locationId }));
  };

  const previewUri = form.imageUri ?? (form.imageUrl ? form.imageUrl : null);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <SafeAreaView style={styles.modalSafe} edges={["top", "bottom"]}>
          {/* Modal header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color={colors.foreground} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
            {/* Image picker */}
            <Text style={styles.fieldLabel}>Dish Image</Text>
            <Pressable style={styles.imagePicker} onPress={pickImage}>
              {previewUri ? (
                <Image source={{ uri: previewUri }} style={styles.imagePreview} contentFit="cover" />
              ) : (
                <View style={styles.imagePickerPlaceholder}>
                  <Ionicons name="camera-outline" size={32} color={colors.mutedForeground} />
                  <Text style={styles.imagePickerText}>Pick image</Text>
                </View>
              )}
            </Pressable>

            {/* Fallback URL input */}
            <Input
              label="Or paste image URL"
              placeholder="https://example.com/food.jpg"
              value={form.imageUrl}
              onChangeText={(v) => setForm((f) => ({ ...f, imageUrl: v, imageUri: null }))}
              autoCapitalize="none"
              keyboardType="url"
            />

            <Input
              label="Title *"
              placeholder="e.g. Spicy Biryani"
              value={form.title}
              onChangeText={(v) => setForm((f) => ({ ...f, title: v }))}
            />
            <Input
              label="Description"
              placeholder="Describe your dish..."
              value={form.description}
              onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
              multiline
              numberOfLines={3}
              style={{ minHeight: 80, textAlignVertical: "top" }}
            />
            <Input
              label="Price ($) *"
              placeholder="0.00"
              value={form.price}
              onChangeText={(v) => setForm((f) => ({ ...f, price: v }))}
              keyboardType="decimal-pad"
            />
            <Input
              label="Available Quantity *"
              placeholder="10"
              value={form.available_quantity}
              onChangeText={(v) => setForm((f) => ({ ...f, available_quantity: v }))}
              keyboardType="number-pad"
            />
            <Input
              label="Preparation Time (hours)"
              placeholder="0.5"
              value={form.preparation_time_hours}
              onChangeText={(v) => setForm((f) => ({ ...f, preparation_time_hours: v }))}
              keyboardType="decimal-pad"
            />

            {/* Pickup location picker */}
            <View>
              <Text style={styles.fieldLabel}>Pickup Location *</Text>
              {locations.length === 0 ? (
                <Text style={styles.helperError}>
                  No pickup locations found. Add a location in your profile first.
                </Text>
              ) : (
                <View style={styles.tagsWrap}>
                  {locations.map((loc) => {
                    const selected = form.pickup_location_id === loc.id;
                    const label = `${loc.address || `Location #${loc.id}`}${loc.is_primary ? " (Primary)" : ""}`;
                    return (
                      <Pressable
                        key={loc.id}
                        onPress={() => selectLocation(loc.id)}
                        style={[styles.tagChip, selected && styles.tagChipSelected]}
                      >
                        <Text
                          style={[styles.tagChipText, selected && styles.tagChipTextSelected]}
                          numberOfLines={1}
                        >
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Cuisine types */}
            {cuisineTypes.length > 0 && (
              <View>
                <Text style={styles.fieldLabel}>Cuisine Types</Text>
                <View style={styles.tagsWrap}>
                  {cuisineTypes.map((cuisine) => {
                    const selected = form.cuisine_type_ids.includes(cuisine.id);
                    return (
                      <Pressable
                        key={cuisine.id}
                        onPress={() => toggleCuisine(cuisine.id)}
                        style={[styles.tagChip, selected && styles.tagChipSelected]}
                      >
                        <Text style={[styles.tagChipText, selected && styles.tagChipTextSelected]}>
                          {cuisine.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Active toggle */}
            <View style={styles.toggleRow}>
              <Text style={styles.fieldLabel}>Active</Text>
              <Switch
                value={form.isAvailable}
                onValueChange={(v) => setForm((f) => ({ ...f, isAvailable: v }))}
                trackColor={{ true: colors.primary, false: colors.border }}
                thumbColor={colors.surface}
              />
            </View>

            {/* Dietary tags */}
            {dietaryTags.length > 0 && (
              <View>
                <Text style={styles.fieldLabel}>Dietary Tags</Text>
                <View style={styles.tagsWrap}>
                  {dietaryTags.map((tag) => {
                    const selected = form.dietary_tag_ids.includes(tag.id);
                    return (
                      <Pressable
                        key={tag.id}
                        onPress={() => toggleTag(tag.id)}
                        style={[styles.tagChip, selected && styles.tagChipSelected]}
                      >
                        <Text style={[styles.tagChipText, selected && styles.tagChipTextSelected]}>
                          {tag.code}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
          </ScrollView>

          <View style={styles.modalFooter}>
            <Button variant="outline" onPress={onClose} style={{ flex: 1 }} disabled={saving}>
              Cancel
            </Button>
            <Button onPress={onSave} style={{ flex: 1 }} loading={saving}>
              Save
            </Button>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export default function MenuScreen() {
  const { dbUser, user } = useAuth();
  const [listings, setListings] = useState<FoodListing[]>([]);
  const [dietaryTags, setDietaryTags] = useState<DietaryTag[]>([]);
  const [cuisineTypes, setCuisineTypes] = useState<CuisineType[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [addForm, setAddForm] = useState<DishForm>(EMPTY_FORM);
  const [editForm, setEditForm] = useState<DishForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const hasLoadedRef = useRef(false);

  const fetchMenu = useCallback(async (silent = false) => {
    if (!dbUser) return;
    try {
      // Keep the current list on screen while refetching silently
      // (refocus / pull-to-refresh) instead of flashing the loader.
      if (!silent) setLoading(true);
      const [data, tags, cuisines] = await Promise.all([
        menuService.getChefListings(dbUser.id.toString()),
        menuService.getDietaryTags(),
        cuisineService.getCuisineTypes(),
      ]);
      setListings(Array.isArray(data) ? data : []);
      setDietaryTags(Array.isArray(tags) ? tags : []);
      setCuisineTypes(Array.isArray(cuisines) ? cuisines : []);
    } catch (err) {
      console.error("Failed to fetch menu:", err);
    } finally {
      setLoading(false);
    }
  }, [dbUser]);

  useFocusEffect(
    useCallback(() => {
      fetchMenu(hasLoadedRef.current);
      hasLoadedRef.current = true;
    }, [fetchMenu])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchMenu(true);
    } finally {
      setRefreshing(false);
    }
  }, [fetchMenu]);

  // ------------------------------------------------------------------
  // Chef-status gating helpers
  // ------------------------------------------------------------------
  const chefActive = isChefActive(dbUser);

  const requireActiveChef = (action: string): boolean => {
    if (!chefActive) {
      Alert.alert(
        "Account not active",
        `You must be an active chef to ${action}.`
      );
      return false;
    }
    return true;
  };

  const defaultLocationId = (): number | null => {
    const locs = dbUser?.locations ?? [];
    const primary = locs.find((l) => l.is_primary) ?? locs[0];
    return primary?.id ?? null;
  };

  // ------------------------------------------------------------------
  // Toggle active/inactive
  // ------------------------------------------------------------------
  const handleToggle = async (id: number, current: FoodListing["status"]) => {
    if (!requireActiveChef("update dishes")) return;
    const newStatus: FoodListing["status"] = current === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    // Optimistic update
    setListings((prev) =>
      prev.map((l) => (l.id === id ? { ...l, status: newStatus } : l))
    );
    try {
      await menuService.updateListing(id, { status: newStatus });
    } catch (err) {
      console.error("Failed to toggle status:", err);
      // Revert
      setListings((prev) =>
        prev.map((l) => (l.id === id ? { ...l, status: current } : l))
      );
    }
  };

  // ------------------------------------------------------------------
  // Delete
  // ------------------------------------------------------------------
  const handleDelete = (id: number) => {
    if (!requireActiveChef("delete dishes")) return;
    Alert.alert("Delete Dish", "Are you sure you want to delete this dish?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await menuService.deleteListing(id);
            setListings((prev) => prev.filter((l) => l.id !== id));
          } catch (err) {
            Alert.alert("Error", "Failed to delete dish. Please try again.");
          }
        },
      },
    ]);
  };

  // ------------------------------------------------------------------
  // Open edit modal
  // ------------------------------------------------------------------
  const openEdit = (item: FoodListing) => {
    if (!requireActiveChef("edit dishes")) return;
    const primaryImg = item.images?.find((i) => i.is_primary)?.image_url ?? item.images?.[0]?.image_url ?? "";
    setEditingId(item.id);
    setEditForm({
      title: item.title,
      description: item.description ?? "",
      price: item.price.toString(),
      available_quantity: item.available_quantity.toString(),
      preparation_time_hours: prepMinutesToHours(item.preparation_time_minutes),
      dietary_tag_ids: item.dietary_tags?.map((t) => t.id) ?? [],
      cuisine_type_ids: item.cuisine_types?.map((c) => c.id) ?? [],
      pickup_location_id: item.pickup_location_id ?? defaultLocationId(),
      imageUri: null,
      imageUrl: primaryImg,
      isAvailable: item.status === "ACTIVE",
    });
    setShowEditModal(true);
  };

  // ------------------------------------------------------------------
  // Save helpers
  // ------------------------------------------------------------------
  const resolveImageUrl = async (form: DishForm): Promise<string> => {
    if (form.imageUri) {
      const chefUid = user?.id ?? "anon";
      return uploadImageToCloudinary(form.imageUri, chefUid);
    }
    return form.imageUrl.trim();
  };

  // Open the add-dish modal, pre-filling prep time from the chef's saved
  // default and defaulting the pickup location to the chef's primary location.
  const openAdd = () => {
    if (!requireActiveChef("add dishes")) return;
    const savedPrep = dbUser?.chef_profile?.default_prep_time_minutes;
    setAddForm({
      ...EMPTY_FORM,
      preparation_time_hours: prepMinutesToHours(savedPrep),
      pickup_location_id: defaultLocationId(),
    });
    setShowAddModal(true);
  };

  const handleAdd = async () => {
    if (!requireActiveChef("add dishes")) return;
    if (!addForm.title.trim()) {
      Alert.alert("Validation", "Title is required.");
      return;
    }
    const price = parseFloat(addForm.price);
    if (isNaN(price) || price < 0) {
      Alert.alert("Validation", "Enter a valid price.");
      return;
    }
    const qty = parseInt(addForm.available_quantity);
    if (isNaN(qty) || qty < 0) {
      Alert.alert("Validation", "Enter a valid quantity.");
      return;
    }
    if (!dbUser?.locations || dbUser.locations.length === 0) {
      Alert.alert("Validation", "Add a pickup location in your profile first.");
      return;
    }
    const pickupLocationId = addForm.pickup_location_id;
    if (pickupLocationId == null) {
      Alert.alert("Validation", "Please select a pickup location.");
      return;
    }

    let imageUrl = "";
    try {
      imageUrl = await resolveImageUrl(addForm);
    } catch {
      Alert.alert("Image Upload", "Image upload failed. You can paste a URL instead.");
      return;
    }

    if (!imageUrl) {
      Alert.alert("Validation", "Please provide an image (pick or paste a URL).");
      return;
    }

    setSaving(true);
    try {
      const createPayload: FoodListingCreate & { cuisine_type_ids?: number[] } = {
        title: addForm.title.trim(),
        description: addForm.description.trim() || undefined,
        price,
        available_quantity: qty,
        status: addForm.isAvailable ? "ACTIVE" : "INACTIVE",
        pickup_location_id: pickupLocationId,
        dietary_tag_ids: addForm.dietary_tag_ids,
        cuisine_type_ids: addForm.cuisine_type_ids,
        image_url: imageUrl,
        preparation_time_minutes: prepHoursToMinutes(addForm.preparation_time_hours),
      };
      const listing = await menuService.createListing(createPayload);
      setListings((prev) => [listing, ...prev]);
      setShowAddModal(false);
      setAddForm(EMPTY_FORM);
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to create dish.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!editingId) return;
    if (!requireActiveChef("edit dishes")) return;
    if (!editForm.title.trim()) {
      Alert.alert("Validation", "Title is required.");
      return;
    }
    const pickupLocationId = editForm.pickup_location_id;
    if (pickupLocationId == null) {
      Alert.alert("Validation", "Please select a pickup location.");
      return;
    }

    let imageUrl: string | undefined;
    if (editForm.imageUri) {
      try {
        imageUrl = await resolveImageUrl(editForm);
      } catch {
        Alert.alert("Image Upload", "Image upload failed. Continuing without image change.");
      }
    }

    setSaving(true);
    try {
      const updatePayload: FoodListingUpdate & { cuisine_type_ids?: number[] } = {
        title: editForm.title.trim(),
        description: editForm.description.trim() || undefined,
        price: parseFloat(editForm.price) || 0,
        available_quantity: parseInt(editForm.available_quantity) || 0,
        status: editForm.isAvailable ? "ACTIVE" : "INACTIVE",
        pickup_location_id: pickupLocationId,
        dietary_tag_ids: editForm.dietary_tag_ids,
        cuisine_type_ids: editForm.cuisine_type_ids,
        preparation_time_minutes: prepHoursToMinutes(editForm.preparation_time_hours),
      };
      const updated = await menuService.updateListing(editingId, updatePayload);
      setListings((prev) =>
        prev.map((l) => (l.id === editingId ? updated : l))
      );
      setShowEditModal(false);
      setEditingId(null);
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to update dish.");
    } finally {
      setSaving(false);
    }
  };

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.screenTitle}>My Menu</Text>
        <Pressable
          style={styles.refreshBtn}
          onPress={() => fetchMenu()}
          hitSlop={8}
        >
          <Ionicons name="refresh-outline" size={22} color={colors.primary} />
        </Pressable>
      </View>

      {loading ? (
        <LoadingSpinner message="Loading menu…" />
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <DishRow
              item={item}
              onToggle={handleToggle}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          )}
          contentContainerStyle={listings.length === 0 ? styles.emptyContainer : styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="🍽️"
              title="No dishes yet"
              description="Add your first dish to start taking orders."
            />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      {/* FAB */}
      <Pressable style={styles.fab} onPress={openAdd}>
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>

      {/* Add modal */}
      <DishModal
        visible={showAddModal}
        form={addForm}
        setForm={setAddForm}
        dietaryTags={dietaryTags}
        cuisineTypes={cuisineTypes}
        locations={dbUser?.locations ?? []}
        saving={saving}
        onClose={() => setShowAddModal(false)}
        onSave={handleAdd}
        title="Add Dish"
      />

      {/* Edit modal */}
      <DishModal
        visible={showEditModal}
        form={editForm}
        setForm={setEditForm}
        dietaryTags={dietaryTags}
        cuisineTypes={cuisineTypes}
        locations={dbUser?.locations ?? []}
        saving={saving}
        onClose={() => { setShowEditModal(false); setEditingId(null); }}
        onSave={handleEdit}
        title="Edit Dish"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  screenTitle: { ...typography.xl, fontWeight: "700", color: colors.foreground },
  refreshBtn: { padding: 4 },

  listContent: { padding: spacing.md, paddingBottom: 100 },
  emptyContainer: { flex: 1, justifyContent: "center" },
  separator: { height: spacing.sm },

  row: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadow.sm,
    alignItems: "center",
    gap: spacing.sm,
  },
  rowImage: {
    width: 70,
    height: 70,
    borderRadius: radius.md,
  },
  rowImageFallback: {
    backgroundColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  rowImagePressed: { opacity: 0.7 },
  rowImageEditBadge: {
    position: "absolute",
    right: 4,
    bottom: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  rowInfo: { flex: 1, gap: 3 },
  rowTitle: { ...typography.base, fontWeight: "600", color: colors.foreground },
  rowPrice: { ...typography.sm, color: colors.primary, fontWeight: "700" },
  rowQty: { ...typography.xs, color: colors.mutedForeground },
  rowTags: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 3 },
  rowActions: { alignItems: "center", justifyContent: "center", gap: spacing.sm },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  actionBtnPressed: { opacity: 0.6 },
  deleteBtn: {
    backgroundColor: "rgba(224, 34, 34, 0.08)",
    borderColor: "rgba(224, 34, 34, 0.25)",
  },

  fab: {
    position: "absolute",
    bottom: 32,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.lg,
  },

  // Modal
  modalSafe: { flex: 1, backgroundColor: colors.background },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: { ...typography.xl, fontWeight: "700", color: colors.foreground },
  modalBody: { padding: spacing.md, gap: spacing.md, paddingBottom: 40 },
  modalFooter: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },

  fieldLabel: { ...typography.sm, fontWeight: "600", color: colors.foreground, marginBottom: 4 },
  helperError: { ...typography.xs, color: colors.destructive },

  imagePicker: {
    width: "100%",
    height: 160,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.muted,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: "dashed",
  },
  imagePreview: { width: "100%", height: "100%" },
  imagePickerPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  imagePickerText: { ...typography.sm, color: colors.mutedForeground },

  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  tagsWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  tagChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.muted,
  },
  tagChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.accent,
  },
  tagChipText: { ...typography.xs, fontWeight: "600", color: colors.mutedForeground },
  tagChipTextSelected: { color: colors.primary },
});
