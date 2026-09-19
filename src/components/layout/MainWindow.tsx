import { useEffect } from 'react'
import { usePanelRef } from 'react-resizable-panels'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'
import { motion } from 'motion/react'
import { TitleBar } from '@/components/titlebar/TitleBar'
import { LeftSideBar } from './LeftSideBar'
import { RightSideBar } from './RightSideBar'
import { MainWindowContent } from './MainWindowContent'
import { CommandPalette } from '@/components/command-palette/CommandPalette'
import { PreferencesDialog } from '@/components/preferences/PreferencesDialog'
import { CrashReportDialog } from '@/components/crash-report/CrashReportDialog'
import { Toaster } from 'sonner'
import { useTheme } from '@/hooks/use-theme'
import { useSidebarStore, type SidebarState } from '@/store/sidebar-store'
import { useMainWindowEventListeners } from '@/hooks/useMainWindowEventListeners'
import { cn } from '@/lib/utils'
import {
  slideRightVariants,
  slideLeftVariants,
  springTransition,
} from '@/lib/animations'

/**
 * Layout sizing configuration for resizable panels.
 * All values are percentages of total width.
 * Sidebar defaults + main default must equal 100.
 *
 * react-resizable-panels v4 reads bare numbers as pixels, so these are
 * interpolated into unit-less strings at the call sites to stay percentages.
 */
const LAYOUT = {
  leftSidebar: { default: 20, min: 15, max: 40 },
  rightSidebar: { default: 20, min: 15, max: 40 },
  main: { min: 30 },
} as const

// Main content default is calculated to ensure totals sum to 100%
const MAIN_CONTENT_DEFAULT =
  100 - LAYOUT.leftSidebar.default - LAYOUT.rightSidebar.default

export function MainWindow() {
  const { theme } = useTheme()
  const leftSidebarVisible = useSidebarStore(
    (state: SidebarState) => state.leftSidebarVisible
  )
  const rightSidebarVisible = useSidebarStore(
    (state: SidebarState) => state.rightSidebarVisible
  )

  const leftPanelRef = usePanelRef()
  const rightPanelRef = usePanelRef()

  // Set up global event listeners (keyboard shortcuts, etc.)
  useMainWindowEventListeners()

  // v4 applies className to a nested div, so `hidden` no longer removes the
  // panel itself — collapse it to zero width instead.
  useEffect(() => {
    const panel = leftPanelRef.current
    if (!panel) return
    if (leftSidebarVisible) panel.expand()
    else panel.collapse()
  }, [leftPanelRef, leftSidebarVisible])

  useEffect(() => {
    const panel = rightPanelRef.current
    if (!panel) return
    if (rightSidebarVisible) panel.expand()
    else panel.collapse()
  }, [rightPanelRef, rightSidebarVisible])

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden rounded-[var(--app-corner-radius)] bg-background">
      <TitleBar />

      <div className="flex flex-1 overflow-hidden">
        <ResizablePanelGroup orientation="horizontal">
          <ResizablePanel
            panelRef={leftPanelRef}
            defaultSize={`${LAYOUT.leftSidebar.default}`}
            minSize={`${LAYOUT.leftSidebar.min}`}
            maxSize={`${LAYOUT.leftSidebar.max}`}
            collapsible
            collapsedSize={0}
          >
            <motion.div
              variants={slideRightVariants}
              initial="initial"
              animate="animate"
              transition={springTransition}
              className="h-full"
            >
              <LeftSideBar />
            </motion.div>
          </ResizablePanel>

          <ResizableHandle
            disabled={!leftSidebarVisible}
            className={cn(!leftSidebarVisible && 'hidden')}
          />

          <ResizablePanel
            defaultSize={`${MAIN_CONTENT_DEFAULT}`}
            minSize={`${LAYOUT.main.min}`}
          >
            <MainWindowContent />
          </ResizablePanel>

          <ResizableHandle
            disabled={!rightSidebarVisible}
            className={cn(!rightSidebarVisible && 'hidden')}
          />

          <ResizablePanel
            panelRef={rightPanelRef}
            defaultSize={`${LAYOUT.rightSidebar.default}`}
            minSize={`${LAYOUT.rightSidebar.min}`}
            maxSize={`${LAYOUT.rightSidebar.max}`}
            collapsible
            collapsedSize={0}
          >
            <motion.div
              variants={slideLeftVariants}
              initial="initial"
              animate="animate"
              transition={springTransition}
              className="h-full"
            >
              <RightSideBar />
            </motion.div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Global UI Components (hidden until triggered) */}
      <CommandPalette />
      <PreferencesDialog />
      <CrashReportDialog />
      <Toaster
        position="bottom-right"
        theme={
          theme === 'dark' ? 'dark' : theme === 'light' ? 'light' : 'system'
        }
        className="toaster group"
        toastOptions={{
          classNames: {
            toast:
              'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
            description: 'group-[.toast]:text-muted-foreground',
            actionButton:
              'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
            cancelButton:
              'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
          },
        }}
      />
    </div>
  )
}
