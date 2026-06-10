import React, { createContext, useContext, useState, ReactNode } from "react";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  chefId: string;
  chefName: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">, availableQty?: number) => { success: boolean; message?: string; requiresSwitch?: boolean; pendingItem?: Omit<CartItem, "quantity"> };
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  total: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>([]);

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
      if (existing) return prev.map(i => i.id === newItem.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { ...newItem, quantity: 1 }];
    });

    return { success: true };
  };

  const switchChefAndAdd = (newItem: Omit<CartItem, "quantity">) => {
    setItems([{ ...newItem, quantity: 1 }]);
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) { removeItem(id); return; }
    setItems(prev => prev.map(i => i.id === id ? { ...i, quantity } : i));
  };

  const clearCart = () => setItems([]);

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, total }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
};
