import { create, type StateCreator } from 'zustand'
import { devtools } from 'zustand/middleware'

export interface SidebarState {
  leftSidebarVisible: boolean
  rightSidebarVisible: boolean

  toggleLeftSidebar: () => void
  setLeftSidebarVisible: (visible: boolean) => void
  toggleRightSidebar: () => void
  setRightSidebarVisible: (visible: boolean) => void
}

const sidebarStoreCreator: StateCreator<
  SidebarState,
  [['zustand/devtools', never]]
> = set => ({
  leftSidebarVisible: true,
  rightSidebarVisible: true,

  toggleLeftSidebar: () =>
    set(
      (state: SidebarState) => ({
        leftSidebarVisible: !state.leftSidebarVisible,
      }),
      undefined,
      'toggleLeftSidebar'
    ),

  setLeftSidebarVisible: (visible: boolean) =>
    set({ leftSidebarVisible: visible }, undefined, 'setLeftSidebarVisible'),

  toggleRightSidebar: () =>
    set(
      (state: SidebarState) => ({
        rightSidebarVisible: !state.rightSidebarVisible,
      }),
      undefined,
      'toggleRightSidebar'
    ),

  setRightSidebarVisible: (visible: boolean) =>
    set({ rightSidebarVisible: visible }, undefined, 'setRightSidebarVisible'),
})

export const useSidebarStore = create<SidebarState>()(
  devtools(sidebarStoreCreator, {
    name: 'sidebar-store',
  })
)
