import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ProductWithCategory } from '@shared/schema';

export interface CartItem {
  product: ProductWithCategory;
  quantity: number;
  selectedSize?: string;
}

interface CartStore {
  items: CartItem[];
  isOpen: boolean;
  addItem: (product: ProductWithCategory, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  updateSize: (productId: string, size: string) => void;
  clearCart: () => void;
  setIsOpen: (isOpen: boolean) => void;
  getTotalItems: () => number;
  getTotalSavings: () => number;
  // Legacy methods for compatibility
  getItemCount: () => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      
      addItem: (product, quantity = 1) => {
        const { items } = get();
        const existingItem = items.find(item => item.product.id === product.id);
        
        if (existingItem) {
          set({
            items: items.map(item =>
              item.product.id === product.id
                ? { ...item, quantity: item.quantity + quantity }
                : item
            )
          });
        } else {
          set({
            items: [...items, { product, quantity }]
          });
        }
      },
      
      removeItem: (productId) => {
        set({
          items: get().items.filter(item => item.product.id !== productId)
        });
      },
      
      updateQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(productId);
          return;
        }
        
        set({
          items: get().items.map(item =>
            item.product.id === productId
              ? { ...item, quantity }
              : item
          )
        });
      },
      
      updateSize: (productId, size) => {
        set({
          items: get().items.map(item =>
            item.product.id === productId
              ? { ...item, selectedSize: size }
              : item
          )
        });
      },
      
      clearCart: () => {
        set({ items: [] });
      },
      
      setIsOpen: (isOpen) => {
        set({ isOpen });
      },
      
      getTotalItems: () => {
        return get().items.reduce((total, item) => total + item.quantity, 0);
      },
      
      getTotalSavings: () => {
        return get().items.reduce((total, item) => {
          const product = item.product;
          if (product.originalPrice && product.price) {
            const originalPrice = parseFloat(product.originalPrice.replace(/\./g, ''));
            const currentPrice = parseFloat(product.price.replace(/\./g, ''));
            const savings = (originalPrice - currentPrice) * item.quantity;
            return total + savings;
          }
          return total;
        }, 0);
      },
      
      // Legacy method for compatibility
      getItemCount: () => {
        return get().getTotalItems();
      }
    }),
    {
      name: 'fastsniker-cart',
      version: 1,
    }
  )
);
