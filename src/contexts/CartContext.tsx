import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { toTitleCase } from "@/lib/titleCase";

export interface CartItem {
  /** Composite key: a dish appears once per variant. */
  id: string;
  foodListingId: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  chefId: string;
  chefName: string;
  variantId?: number;
  variantName?: string;
}

export type CartItemInput = Omit<CartItem, "id" | "quantity">;

interface AddItemResult {
  success: boolean;
  message?: string;
  requiresSwitch?: boolean;
  pendingItem?: CartItemInput;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: CartItemInput, quantity?: number) => AddItemResult;
  switchChefAndAdd: (item: CartItemInput, quantity?: number) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  total: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = "mealhost.cart";
const MAX_ORDER_QUANTITY = 100;

export const getCartItemId = (foodListingId: string, variantId?: number) =>
  `${foodListingId}:${variantId ?? "simple"}`;

const clampQuantity = (quantity: number) =>
  Math.min(MAX_ORDER_QUANTITY, Math.max(1, Math.floor(quantity) || 1));

/**
 * Rebuild persisted rows on the current shape.
 *
 * Carts stored before variants existed keyed on the bare listing id and had no
 * `foodListingId`, so recover it from the old id and re-key.
 */
const migrateStoredCart = (parsed: unknown): CartItem[] => {
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((item): CartItem[] => {
    if (!item || typeof item !== "object") return [];
    const raw = item as Partial<CartItem> & { id?: string };
    const foodListingId = raw.foodListingId || String(raw.id ?? "").split(":")[0];
    if (!foodListingId) return [];
    return [
      {
        ...(raw as CartItem),
        foodListingId,
        id: getCartItemId(foodListingId, raw.variantId),
        // Carts saved before display-casing existed keep the raw chef-typed case.
        name: toTitleCase(raw.name),
        chefName: toTitleCase(raw.chefName),
        quantity: clampQuantity(raw.quantity ?? 1),
      },
    ];
  });
};

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  // Track hydration so we don't overwrite the persisted cart with the
  // initial empty state before the stored value has been loaded.
  const hydrated = useRef(false);

  // Load persisted cart on mount
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(CART_STORAGE_KEY);
        if (active && raw) setItems(migrateStoredCart(JSON.parse(raw)));
      } catch {
        // ignore load / parse errors
      } finally {
        hydrated.current = true;
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Persist cart on every change (after hydration)
  useEffect(() => {
    if (!hydrated.current) return;
    AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items)).catch(() => {
      // ignore write errors
    });
  }, [items]);

  const addItem = (item: CartItemInput, quantity = 1): AddItemResult => {
    // Dish and kitchen names are chef-typed free text; store them display-cased
    // so every cart, checkout and toast reads the same way.
    const newItem: CartItemInput = {
      ...item,
      name: toTitleCase(item.name),
      chefName: toTitleCase(item.chefName),
    };
    const cartChefId = items.length > 0 ? items[0].chefId : null;
    if (cartChefId && cartChefId !== newItem.chefId) {
      // Return info to caller so it can show a native Alert
      return {
        success: false,
        requiresSwitch: true,
        pendingItem: newItem,
        message: `Your cart has items from ${items[0].chefName}. Clear cart and add from ${newItem.chefName}?`,
      };
    }

    const id = getCartItemId(newItem.foodListingId, newItem.variantId);
    const quantityToAdd = clampQuantity(quantity);

    setItems((prev) => {
      const existing = prev.find((i) => i.id === id);
      if (existing) {
        return prev.map((i) =>
          i.id === id
            ? { ...i, quantity: Math.min(MAX_ORDER_QUANTITY, i.quantity + quantityToAdd) }
            : i,
        );
      }
      return [...prev, { ...newItem, id, quantity: quantityToAdd }];
    });

    return { success: true };
  };

  const switchChefAndAdd = (newItem: CartItemInput, quantity = 1) => {
    setItems([
      {
        ...newItem,
        id: getCartItemId(newItem.foodListingId, newItem.variantId),
        quantity: clampQuantity(quantity),
      },
    ]);
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(id);
      return;
    }
    setItems((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, quantity: Math.min(MAX_ORDER_QUANTITY, quantity) } : i,
      ),
    );
  };

  const clearCart = () => setItems([]);

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <CartContext.Provider
      value={{ items, addItem, switchChefAndAdd, removeItem, updateQuantity, clearCart, total }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
};
