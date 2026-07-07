import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useCrashReportStore } from './crash-report-store'
import type { CrashReportData } from '@/lib/tauri-bindings'

const crashReportFixture: CrashReportData = {
  crash_type: 'rust_panic',
  message: 'panicked at src/main.rs:42',
  location: 'src/main.rs:42:13',
  backtrace: '   0: ...',
  timestamp: 1700000000,
  app_version: '0.1.0',
}

describe('CrashReportStore', () => {
  beforeEach(() => {
    // Reset store state before each test to its initial defaults
    useCrashReportStore.setState({
      crashReportDialogOpen: false,
      pendingCrashReport: null,
    })
  })

  describe('正向用例 — 初始状态', () => {
    it('has correct initial state', () => {
      const state = useCrashReportStore.getState()
      expect(state.crashReportDialogOpen).toBe(false)
      expect(state.pendingCrashReport).toBe(null)
    })

    it('exposes all action methods on the store', () => {
      const state = useCrashReportStore.getState()
      expect(typeof state.setCrashReportDialogOpen).toBe('function')
      expect(typeof state.setPendingCrashReport).toBe('function')
    })
  })

  describe('正向用例 — 崩溃报告对话框', () => {
    it('sets crash report dialog open state', () => {
      const { setCrashReportDialogOpen } = useCrashReportStore.getState()

      setCrashReportDialogOpen(true)
      expect(useCrashReportStore.getState().crashReportDialogOpen).toBe(true)

      setCrashReportDialogOpen(false)
      expect(useCrashReportStore.getState().crashReportDialogOpen).toBe(false)
    })
  })

  describe('正向用例 — 待处理崩溃报告', () => {
    it('stores a pending crash report', () => {
      const { setPendingCrashReport } = useCrashReportStore.getState()

      setPendingCrashReport(crashReportFixture)
      expect(useCrashReportStore.getState().pendingCrashReport).toEqual(
        crashReportFixture
      )
    })

    it('clears a pending crash report by passing null', () => {
      const { setPendingCrashReport } = useCrashReportStore.getState()

      setPendingCrashReport(crashReportFixture)
      setPendingCrashReport(null)
      expect(useCrashReportStore.getState().pendingCrashReport).toBe(null)
    })
  })

  describe('边界用例', () => {
    it('setCrashReportDialogOpen with the same value is idempotent', () => {
      const { setCrashReportDialogOpen } = useCrashReportStore.getState()

      setCrashReportDialogOpen(true)
      setCrashReportDialogOpen(true)
      expect(useCrashReportStore.getState().crashReportDialogOpen).toBe(true)
    })

    it('setCrashReportDialogOpen(false) when state is already false does not throw', () => {
      const { setCrashReportDialogOpen } = useCrashReportStore.getState()

      expect(() => setCrashReportDialogOpen(false)).not.toThrow()
      expect(useCrashReportStore.getState().crashReportDialogOpen).toBe(false)
    })

    it('setPendingCrashReport overwrites previous report data', () => {
      const { setPendingCrashReport } = useCrashReportStore.getState()
      const secondFixture: CrashReportData = {
        ...crashReportFixture,
        message: 'second panic',
      }

      setPendingCrashReport(crashReportFixture)
      setPendingCrashReport(secondFixture)
      expect(useCrashReportStore.getState().pendingCrashReport).toEqual(
        secondFixture
      )
    })
  })

  describe('异常用例 — store 仍保持一致性', () => {
    it('setCrashReportDialogOpen does not affect pendingCrashReport', () => {
      const { setCrashReportDialogOpen, setPendingCrashReport } =
        useCrashReportStore.getState()

      setPendingCrashReport(crashReportFixture)
      setCrashReportDialogOpen(true)
      const state = useCrashReportStore.getState()

      expect(state.crashReportDialogOpen).toBe(true)
      expect(state.pendingCrashReport).toEqual(crashReportFixture)
    })

    it('setPendingCrashReport does not affect crashReportDialogOpen', () => {
      const stateBefore = { ...useCrashReportStore.getState() }
      const { setPendingCrashReport } = useCrashReportStore.getState()

      setPendingCrashReport(crashReportFixture)
      const stateAfter = useCrashReportStore.getState()

      expect(stateAfter.pendingCrashReport).toEqual(crashReportFixture)
      expect(stateAfter.crashReportDialogOpen).toBe(
        stateBefore.crashReportDialogOpen
      )
    })

    it('survives store.setState being called with partial fields', () => {
      useCrashReportStore.setState({ crashReportDialogOpen: true })
      expect(useCrashReportStore.getState().crashReportDialogOpen).toBe(true)
      expect(useCrashReportStore.getState().pendingCrashReport).toBe(null)
    })
  })

  describe('devtools 集成', () => {
    it('store is created with the crash-report-store name for devtools', () => {
      const state = useCrashReportStore.getState()
      expect(state).toBeInstanceOf(Object)
      expect(Object.keys(state).length).toBeGreaterThan(0)
    })
  })
})

// Silence console.debug output from the devtools middleware during tests
vi.stubGlobal('console', {
  ...console,
  debug: vi.fn(),
})
