import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CartState {
  userId: string;
  items: Array<{
    id: string;
    productId: string;
    quantity: number;
  }>;
  setUserId: (userId: string) => void;
  addItem: (productId: string, quantity?: number) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  getItemCount: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      userId: 'guest-user', // In a real app, this would be set on login
      items: [],
      
      setUserId: (userId: string) => set({ userId }),
      
      addItem: (productId: string, quantity = 1) => {
        const { items } = get();
        const existingItem = items.find(item => item.productId === productId);
        
        if (existingItem) {
          set({
            items: items.map(item =>
              item.productId === productId
                ? { ...item, quantity: item.quantity + quantity }
                : item
            )
          });
        } else {
          set({
            items: [...items, {
              id: Math.random().toString(36).substr(2, 9),
              productId,
              quantity
            }]
          });
        }
      },
      
      removeItem: (id: string) => {
        set({
          items: get().items.filter(item => item.id !== id)
        });
      },
      
      updateQuantity: (id: string, quantity: number) => {
        if (quantity <= 0) {
          get().removeItem(id);
          return;
        }
        
        set({
          items: get().items.map(item =>
            item.id === id ? { ...item, quantity } : item
          )
        });
      },
      
      clearCart: () => set({ items: [] }),
      
      getItemCount: () => {
        return get().items.reduce((total, item) => total + item.quantity, 0);
      },
    }),
    {
      name: 'cart-storage',
    }
  )
);
