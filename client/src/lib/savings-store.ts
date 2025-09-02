import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
  
  // Actions
  addSaving: (amount: number) => void;
  resetSession: () => void;
  unlockAchievement: (achievementId: string) => void;
  triggerSavingAnimation: (amount: number) => void;
  hideSavingAnimation: () => void;
  getAchievements: () => SavingsAchievement[];
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

      addSaving: (amount: number) => {
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
      }
    }),
    {
      name: 'zapateria-savings-storage',
      partialize: (state) => ({
        totalSaved: state.totalSaved,
        achievementsUnlocked: state.achievementsUnlocked
      })
    }
  )
);