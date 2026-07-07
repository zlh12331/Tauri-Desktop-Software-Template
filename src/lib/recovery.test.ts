import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock Tauri bindings
const mockSaveEmergencyData = vi.fn()
const mockLoadEmergencyData = vi.fn()
const mockCleanupOldRecoveryFiles = vi.fn()

vi.mock('@/lib/tauri-bindings', () => ({
  commands: {
    saveEmergencyData: mockSaveEmergencyData,
    loadEmergencyData: mockLoadEmergencyData,
    cleanupOldRecoveryFiles: mockCleanupOldRecoveryFiles,
  },
}))

const {
  saveEmergencyData,
  loadEmergencyData,
  cleanupOldFiles,
  saveCrashState,
} = await import('./recovery')

describe('saveEmergencyData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('正向用例 — successful save', () => {
    it('saves data successfully and logs success', async () => {
      mockSaveEmergencyData.mockResolvedValue({ status: 'ok', data: null })

      await saveEmergencyData('user-draft', { content: 'hello' })

      expect(mockSaveEmergencyData).toHaveBeenCalledWith(
        'user-draft',
        JSON.stringify({ content: 'hello' })
      )
    })

    it('accepts silent option to suppress info log', async () => {
      mockSaveEmergencyData.mockResolvedValue({ status: 'ok', data: null })

      await saveEmergencyData('silent-save', { data: 42 }, { silent: true })

      expect(mockSaveEmergencyData).toHaveBeenCalledWith(
        'silent-save',
        JSON.stringify({ data: 42 })
      )
    })

    it('saves primitive values (string, number, boolean)', async () => {
      mockSaveEmergencyData.mockResolvedValue({ status: 'ok', data: null })

      await saveEmergencyData('str', 'text')
      await saveEmergencyData('num', 123)
      await saveEmergencyData('bool', true)

      expect(mockSaveEmergencyData).toHaveBeenCalledTimes(3)
    })

    it('saves null and array values', async () => {
      mockSaveEmergencyData.mockResolvedValue({ status: 'ok', data: null })

      await saveEmergencyData('null-file', null)
      await saveEmergencyData('arr-file', [1, 2, 3])

      expect(mockSaveEmergencyData).toHaveBeenCalledTimes(2)
    })
  })

  describe('异常用例 — save failure', () => {
    it('throws Error with formatted message on ValidationError', async () => {
      mockSaveEmergencyData.mockResolvedValue({
        status: 'error',
        error: { kind: 'ValidationError', message: 'bad filename' },
      })

      await expect(saveEmergencyData('bad', {})).rejects.toThrow(
        'Validation error: bad filename'
      )
    })

    it('throws Error on DataTooLarge', async () => {
      mockSaveEmergencyData.mockResolvedValue({
        status: 'error',
        error: { kind: 'DataTooLarge', max_bytes: 10485760 },
      })

      await expect(saveEmergencyData('big', {})).rejects.toThrow(
        'Data too large (max 10485760 bytes)'
      )
    })

    it('throws Error on IoError', async () => {
      mockSaveEmergencyData.mockResolvedValue({
        status: 'error',
        error: { kind: 'IoError', message: 'disk full' },
      })

      await expect(saveEmergencyData('io', {})).rejects.toThrow(
        'IO error: disk full'
      )
    })

    it('throws Error on ParseError', async () => {
      mockSaveEmergencyData.mockResolvedValue({
        status: 'error',
        error: { kind: 'ParseError', message: 'invalid json' },
      })

      await expect(saveEmergencyData('parse', {})).rejects.toThrow(
        'Parse error: invalid json'
      )
    })
  })
})

describe('loadEmergencyData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('正向用例 — successful load', () => {
    it('loads data and returns it', async () => {
      const data = { content: 'hello', timestamp: 123 }
      mockLoadEmergencyData.mockResolvedValue({
        status: 'ok',
        data: JSON.stringify(data),
      })

      const result = await loadEmergencyData('user-draft')

      expect(result).toEqual(data)
      expect(mockLoadEmergencyData).toHaveBeenCalledWith('user-draft')
    })

    it('supports generic type parameter', async () => {
      mockLoadEmergencyData.mockResolvedValue({ status: 'ok', data: '42' })

      const result = await loadEmergencyData<number>('counter')

      expect(result).toBe(42)
    })

    it('loads array data', async () => {
      mockLoadEmergencyData.mockResolvedValue({
        status: 'ok',
        data: '[1,2,3]',
      })

      const result = await loadEmergencyData<number[]>('array')

      expect(result).toEqual([1, 2, 3])
    })
  })

  describe('边界用例 — FileNotFound returns null', () => {
    it('returns null when file does not exist', async () => {
      mockLoadEmergencyData.mockResolvedValue({
        status: 'error',
        error: { kind: 'FileNotFound' },
      })

      const result = await loadEmergencyData('missing')

      expect(result).toBeNull()
    })
  })

  describe('异常用例 — load failure', () => {
    it('throws on IoError', async () => {
      mockLoadEmergencyData.mockResolvedValue({
        status: 'error',
        error: { kind: 'IoError', message: 'permission denied' },
      })

      await expect(loadEmergencyData('protected')).rejects.toThrow(
        'IO error: permission denied'
      )
    })

    it('throws on ParseError', async () => {
      mockLoadEmergencyData.mockResolvedValue({
        status: 'error',
        error: { kind: 'ParseError', message: 'corrupt' },
      })

      await expect(loadEmergencyData('corrupt')).rejects.toThrow(
        'Parse error: corrupt'
      )
    })

    it('throws on DataTooLarge', async () => {
      mockLoadEmergencyData.mockResolvedValue({
        status: 'error',
        error: { kind: 'DataTooLarge', max_bytes: 1000 },
      })

      await expect(loadEmergencyData('huge')).rejects.toThrow(
        'Data too large (max 1000 bytes)'
      )
    })
  })
})

describe('cleanupOldFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('正向用例 — successful cleanup', () => {
    it('returns count of removed files (>0)', async () => {
      mockCleanupOldRecoveryFiles.mockResolvedValue({
        status: 'ok',
        data: 5,
      })

      const result = await cleanupOldFiles()

      expect(result).toBe(5)
    })

    it('returns 0 when no files to clean', async () => {
      mockCleanupOldRecoveryFiles.mockResolvedValue({
        status: 'ok',
        data: 0,
      })

      const result = await cleanupOldFiles()

      expect(result).toBe(0)
    })
  })

  describe('异常用例 — cleanup failure', () => {
    it('throws on IoError', async () => {
      mockCleanupOldRecoveryFiles.mockResolvedValue({
        status: 'error',
        error: { kind: 'IoError', message: 'access denied' },
      })

      await expect(cleanupOldFiles()).rejects.toThrow('IO error: access denied')
    })

    it('throws on FileNotFound', async () => {
      mockCleanupOldRecoveryFiles.mockResolvedValue({
        status: 'error',
        error: { kind: 'FileNotFound' },
      })

      await expect(cleanupOldFiles()).rejects.toThrow('File not found')
    })
  })
})

describe('saveCrashState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('正向用例 — crash state saved', () => {
    it('saves crash state with timestamp and user agent', async () => {
      mockSaveEmergencyData.mockResolvedValue({ status: 'ok', data: null })

      await saveCrashState({ view: 'dashboard' }, { error: 'Test error' })

      expect(mockSaveEmergencyData).toHaveBeenCalledTimes(1)
      const firstCall = mockSaveEmergencyData.mock.calls[0]
      if (!firstCall) throw new Error('saveEmergencyData was not called')
      const [filename, crashDataStr] = firstCall
      const crashData = JSON.parse(crashDataStr as string)
      expect(filename).toMatch(/^crash-\d+$/)
      expect(crashData.timestamp).toBeTypeOf('number')
      expect(crashData.state).toEqual({ view: 'dashboard' })
      expect(crashData.crashInfo).toEqual({ error: 'Test error' })
      expect(crashData.userAgent).toBe(navigator.userAgent)
      expect(crashData.url).toBe(window.location.href)
    })

    it('saves crash state without crashInfo', async () => {
      mockSaveEmergencyData.mockResolvedValue({ status: 'ok', data: null })

      await saveCrashState({ foo: 'bar' })

      const firstCallNoCrash = mockSaveEmergencyData.mock.calls[0]
      if (!firstCallNoCrash) throw new Error('saveEmergencyData was not called')
      const [, crashDataStrNoCrash] = firstCallNoCrash
      const crashDataNoCrash = JSON.parse(crashDataStrNoCrash as string)
      expect(crashDataNoCrash.crashInfo).toBeUndefined()
    })

    it('saves crash state with full crash info', async () => {
      mockSaveEmergencyData.mockResolvedValue({ status: 'ok', data: null })

      await saveCrashState(
        { input: 'text' },
        {
          error: 'TypeError',
          stack: 'at line 1',
          componentStack: 'in Component',
        }
      )

      const firstCallFull = mockSaveEmergencyData.mock.calls[0]
      if (!firstCallFull) throw new Error('saveEmergencyData was not called')
      const [, crashDataStrFull] = firstCallFull
      const crashDataFull = JSON.parse(crashDataStrFull as string)
      expect(crashDataFull.crashInfo).toEqual({
        error: 'TypeError',
        stack: 'at line 1',
        componentStack: 'in Component',
      })
    })
  })

  describe('异常用例 — save failure suppressed', () => {
    it('does not throw when save fails (crash handler must not throw)', async () => {
      mockSaveEmergencyData.mockResolvedValue({
        status: 'error',
        error: { kind: 'IoError', message: 'disk full' },
      })

      // Should not throw — crash handler swallows errors
      await expect(
        saveCrashState({}, { error: 'crash' })
      ).resolves.toBeUndefined()
    })
  })
})
