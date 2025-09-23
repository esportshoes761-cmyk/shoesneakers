import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ProductWithCategory } from '@shared/schema';

export interface ComparisonStore {
  products: ProductWithCategory[];
  isOpen: boolean;
  addProduct: (product: ProductWithCategory) => void;
  removeProduct: (productId: string) => void;
  clearComparison: () => void;
  setIsOpen: (isOpen: boolean) => void;
  getProductCount: () => number;
  isProductInComparison: (productId: string) => boolean;
}

export const useComparisonStore = create<ComparisonStore>()(
  persist(
    (set, get) => ({
      products: [],
      isOpen: false,
      
      addProduct: (product: ProductWithCategory) => {
        const { products } = get();
        
        // Máximo 4 productos para comparar
        if (products.length >= 4) {
          // Reemplazar el primero con el nuevo
          set({
            products: [...products.slice(1), product]
          });
          return;
        }
        
        // No agregar si ya está en la comparación
        if (products.some(p => p.id === product.id)) {
          return;
        }
        
        set({
          products: [...products, product]
        });
      },
      
      removeProduct: (productId: string) => {
        set({
          products: get().products.filter(p => p.id !== productId)
        });
      },
      
      clearComparison: () => {
        set({ products: [], isOpen: false });
      },
      
      setIsOpen: (isOpen: boolean) => {
        set({ isOpen });
      },
      
      getProductCount: () => {
        return get().products.length;
      },
      
      isProductInComparison: (productId: string) => {
        return get().products.some(p => p.id === productId);
      }
    }),
    {
      name: 'fastsneakers-comparison',
      version: 1,
    }
  )
);