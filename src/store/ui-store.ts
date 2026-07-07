import { create, type StateCreator } from 'zustand'
import { devtools } from 'zustand/middleware'

export interface UIState {
  lastQuickPaneEntry: string | null
  squareCorners: boolean

  setLastQuickPaneEntry: (text: string) => void
  setSquareCorners: (enabled: boolean) => void
}

const uiStoreCreator: StateCreator<
  UIState,
  [['zustand/devtools', never]]
> = set => ({
  lastQuickPaneEntry: null,
  squareCorners: false,

  setLastQuickPaneEntry: (text: string) =>
    set({ lastQuickPaneEntry: text }, undefined, 'setLastQuickPaneEntry'),

  setSquareCorners: (enabled: boolean) => {
    set({ squareCorners: enabled }, undefined, 'setSquareCorners')
  },
})

export const useUIStore = create<UIState>()(
  devtools(uiStoreCreator, {
    name: 'ui-store',
  })
)
