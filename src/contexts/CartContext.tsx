import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  chefId: string;
  chefName: string;
  availableQuantity?: number;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">, availableQty?: number) => { success: boolean; message?: string; requiresSwitch?: boolean; pendingItem?: Omit<CartItem, "quantity"> };
  switchChefAndAdd: (item: Omit<CartItem, "quantity">, availableQty?: number) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  total: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = "mealhost.cart";

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
        if (active && raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) setItems(parsed);
        }
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

  const addItem = (newItem: Omit<CartItem, "quantity">, availableQty?: number) => {
    const cartChefId = items.length > 0 ? items[0].chefId : null;
    if (cartChefId && cartChefId !== newItem.chefId) {
      // Return info to caller so it can show a native Alert
      return { success: false, requiresSwitch: true, pendingItem: newItem, message: `Your cart has items from ${items[0].chefName}. Clear cart and add from ${newItem.chefName}?` };
    }

    const existingItem = items.find(i => i.id === newItem.id);
    const currentQty = existingItem?.quantity ?? 0;
    if (availableQty !== undefined && currentQty >= availableQty) {
      return { success: false, message: `Only ${availableQty} available — can't add more.` };
    }

    setItems(prev => {
      const existing = prev.find(i => i.id === newItem.id);
      if (existing) return prev.map(i => i.id === newItem.id ? { ...i, quantity: i.quantity + 1, availableQuantity: availableQty ?? i.availableQuantity } : i);
      return [...prev, { ...newItem, quantity: 1, availableQuantity: availableQty }];
    });

    return { success: true };
  };

  const switchChefAndAdd = (newItem: Omit<CartItem, "quantity">, availableQty?: number) => {
    setItems([{ ...newItem, quantity: 1, availableQuantity: availableQty }]);
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) { removeItem(id); return; }
    setItems(prev => prev.map(i => {
      if (i.id !== id) return i;
      // Guard: never exceed the dish's available quantity
      if (i.availableQuantity !== undefined && quantity > i.availableQuantity) {
        Alert.alert("Can't Add", `Only ${i.availableQuantity} available — can't add more.`);
        return { ...i, quantity: i.availableQuantity };
      }
      return { ...i, quantity };
    }));
  };

  const clearCart = () => setItems([]);

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, switchChefAndAdd, removeItem, updateQuantity, clearCart, total }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
};
