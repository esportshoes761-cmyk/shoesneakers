import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getCustomerId } from './customer-id';

export interface SavingsAchievement {
  id: string;
  title: string;
  description: string;
  emoji: string;
  threshold: number;
  unlocked: boolean;
  unlockedAt?: Date;
}

export interface SavingsState {
  totalSaved: number;
  sessionSaved: number;
  achievementsUnlocked: string[];
  lastSavingAmount: number;
  showSavingAnimation: boolean;
  appliedDiscount: number; // Descuento aplicado en compra actual
  isLoaded: boolean; // Para saber si los datos se cargaron del servidor
  isSyncing: boolean; // Para indicar que se está sincronizando con el servidor
  
  // Actions
  addSaving: (amount: number) => Promise<void>;
  resetSession: () => void;
  unlockAchievement: (achievementId: string) => void;
  triggerSavingAnimation: (amount: number) => void;
  hideSavingAnimation: () => void;
  getAchievements: () => SavingsAchievement[];
  applyDiscount: (amount: number) => void;
  clearAppliedDiscount: () => void;
  getMaxUsableDiscount: () => number;
  loadFromServer: () => Promise<void>;
  syncToServer: () => Promise<void>;
}

const ACHIEVEMENTS: SavingsAchievement[] = [
  {
    id: 'first_save',
    title: '¡Primer Ahorro!',
    description: 'Ahorraste dinero por primera vez',
    emoji: '🎉',
    threshold: 1,
    unlocked: false
  },
  {
    id: 'smart_shopper',
    title: 'Comprador Inteligente',
    description: 'Ahorraste $10.000 o más',
    emoji: '🧠',
    threshold: 10000,
    unlocked: false
  },
  {
    id: 'deal_hunter',
    title: 'Cazador de Ofertas',
    description: 'Ahorraste $50.000 en total',
    emoji: '🎯',
    threshold: 50000,
    unlocked: false
  },
  {
    id: 'savings_master',
    title: 'Maestro del Ahorro',
    description: 'Ahorraste $100.000 en total',
    emoji: '👑',
    threshold: 100000,
    unlocked: false
  },
  {
    id: 'bargain_legend',
    title: 'Leyenda de Gangas',
    description: 'Ahorraste $250.000 en total',
    emoji: '🏆',
    threshold: 250000,
    unlocked: false
  }
];

export const useSavingsStore = create<SavingsState>()(
  persist(
    (set, get) => ({
      totalSaved: 0,
      sessionSaved: 0,
      achievementsUnlocked: [],
      lastSavingAmount: 0,
      showSavingAnimation: false,
      appliedDiscount: 0,
      isLoaded: false,
      isSyncing: false,

      addSaving: async (amount: number) => {
        const state = get();
        const newTotal = state.totalSaved + amount;
        const newSession = state.sessionSaved + amount;
        
        set({
          totalSaved: newTotal,
          sessionSaved: newSession,
          lastSavingAmount: amount
        });

        // Trigger animation
        get().triggerSavingAnimation(amount);

        // Check for new achievements
        const achievements = get().getAchievements();
        achievements.forEach(achievement => {
          if (!state.achievementsUnlocked.includes(achievement.id) && newTotal >= achievement.threshold) {
            get().unlockAchievement(achievement.id);
          }
        });

        // Sincronizar con el servidor de manera asíncrona
        try {
          const customerId = getCustomerId();
          await fetch(`/api/customer-savings/${customerId}/add-savings`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ amount: amount.toString() })
          });
        } catch (error) {
          console.warn("Failed to sync savings with server:", error);
        }
      },

      resetSession: () => {
        set({ sessionSaved: 0, lastSavingAmount: 0 });
      },

      unlockAchievement: (achievementId: string) => {
        const state = get();
        if (!state.achievementsUnlocked.includes(achievementId)) {
          set({
            achievementsUnlocked: [...state.achievementsUnlocked, achievementId]
          });
        }
      },

      triggerSavingAnimation: (amount: number) => {
        set({ showSavingAnimation: true, lastSavingAmount: amount });
        setTimeout(() => {
          set({ showSavingAnimation: false });
        }, 3000);
      },

      hideSavingAnimation: () => {
        set({ showSavingAnimation: false });
      },

      getAchievements: () => {
        const state = get();
        return ACHIEVEMENTS.map(achievement => ({
          ...achievement,
          unlocked: state.achievementsUnlocked.includes(achievement.id),
          unlockedAt: state.achievementsUnlocked.includes(achievement.id) ? new Date() : undefined
        }));
      },

      applyDiscount: (amount: number) => {
        const state = get();
        const maxDiscount = Math.min(amount, state.totalSaved);
        
        if (maxDiscount > 0) {
          set({
            appliedDiscount: maxDiscount,
            totalSaved: state.totalSaved - maxDiscount
          });
        }
      },

      clearAppliedDiscount: () => {
        set({ appliedDiscount: 0 });
      },

      getMaxUsableDiscount: () => {
        const state = get();
        // Máximo 50% del total ahorrado se puede usar como descuento
        return Math.floor(state.totalSaved * 0.5);
      },

      loadFromServer: async () => {
        const state = get();
        if (state.isSyncing) return; // Evitar múltiples llamadas simultáneas
        
        set({ isSyncing: true });
        
        try {
          const customerId = getCustomerId();
          const response = await fetch(`/api/customer-savings/${customerId}`);
          
          if (response.ok) {
            const serverData = await response.json();
            set({
              totalSaved: parseFloat(serverData.totalSaved || "0"),
              achievementsUnlocked: serverData.achievementsUnlocked || [],
              isLoaded: true,
              isSyncing: false
            });
          } else {
            console.warn("Error loading savings from server");
            set({ isLoaded: true, isSyncing: false });
          }
        } catch (error) {
          console.warn("Failed to load savings from server:", error);
          set({ isLoaded: true, isSyncing: false });
        }
      },

      syncToServer: async () => {
        const state = get();
        if (state.isSyncing) return; // Evitar múltiples llamadas simultáneas
        
        set({ isSyncing: true });
        
        try {
          const customerId = getCustomerId();
          
          // Sincronizar ahorros actuales con el servidor
          const response = await fetch(`/api/customer-savings/${customerId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              totalSaved: state.totalSaved.toString(),
              achievementsUnlocked: state.achievementsUnlocked
            })
          });
          
          if (!response.ok) {
            console.warn("Error syncing savings to server");
          }
        } catch (error) {
          console.warn("Failed to sync savings to server:", error);
        } finally {
          set({ isSyncing: false });
        }
      }
    }),
    {
      name: 'zapateria-savings-storage',
      partialize: (state) => ({
        totalSaved: state.totalSaved,
        achievementsUnlocked: state.achievementsUnlocked,
        appliedDiscount: state.appliedDiscount
      })
    }
  )
);