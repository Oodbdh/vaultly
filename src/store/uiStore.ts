import { create } from 'zustand';

/**
 * Global UI state for surfaces that live outside the screen tree — the add
 * sheet is opened by the FAB from any tab, so it can't be local to one screen.
 */
type UIState = {
  addSheetOpen: boolean;
  openAddSheet: () => void;
  closeAddSheet: () => void;
};

export const useUIStore = create<UIState>((set) => ({
  addSheetOpen: false,
  openAddSheet: () => set({ addSheetOpen: true }),
  closeAddSheet: () => set({ addSheetOpen: false }),
}));
