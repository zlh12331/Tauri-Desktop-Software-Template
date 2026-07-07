import { create, type StateCreator } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { CrashReportData } from '@/lib/tauri-bindings'

export interface CrashReportState {
  crashReportDialogOpen: boolean
  pendingCrashReport: CrashReportData | null

  setCrashReportDialogOpen: (open: boolean) => void
  setPendingCrashReport: (data: CrashReportData | null) => void
}

const crashReportStoreCreator: StateCreator<
  CrashReportState,
  [['zustand/devtools', never]]
> = set => ({
  crashReportDialogOpen: false,
  pendingCrashReport: null,

  setCrashReportDialogOpen: (open: boolean) =>
    set({ crashReportDialogOpen: open }, undefined, 'setCrashReportDialogOpen'),

  setPendingCrashReport: (data: CrashReportData | null) =>
    set({ pendingCrashReport: data }, undefined, 'setPendingCrashReport'),
})

export const useCrashReportStore = create<CrashReportState>()(
  devtools(crashReportStoreCreator, {
    name: 'crash-report-store',
  })
)
