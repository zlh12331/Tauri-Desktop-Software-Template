import { create, type StateCreator } from 'zustand'
import { devtools } from 'zustand/middleware'

export interface DialogState {
  commandPaletteOpen: boolean
  preferencesOpen: boolean

  toggleCommandPalette: () => void
  setCommandPaletteOpen: (open: boolean) => void
  togglePreferences: () => void
  setPreferencesOpen: (open: boolean) => void
}

const dialogStoreCreator: StateCreator<
  DialogState,
  [['zustand/devtools', never]]
> = set => ({
  commandPaletteOpen: false,
  preferencesOpen: false,

  toggleCommandPalette: () =>
    set(
      (state: DialogState) => ({
        commandPaletteOpen: !state.commandPaletteOpen,
      }),
      undefined,
      'toggleCommandPalette'
    ),

  setCommandPaletteOpen: (open: boolean) =>
    set({ commandPaletteOpen: open }, undefined, 'setCommandPaletteOpen'),

  togglePreferences: () =>
    set(
      (state: DialogState) => ({ preferencesOpen: !state.preferencesOpen }),
      undefined,
      'togglePreferences'
    ),

  setPreferencesOpen: (open: boolean) =>
    set({ preferencesOpen: open }, undefined, 'setPreferencesOpen'),
})

export const useDialogStore = create<DialogState>()(
  devtools(dialogStoreCreator, {
    name: 'dialog-store',
  })
)
