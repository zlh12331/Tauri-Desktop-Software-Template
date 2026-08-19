import { describe, it, expect } from 'vitest'
import { redactString, isSensitiveKey, redactObject } from './redact'

describe('redactString — 正向用例', () => {
  it('redacts api_key key-value pair', () => {
    expect(redactString('api_key=abc123')).toBe('api_key=***')
  })

  it('redacts token key-value pair (unquoted value)', () => {
    expect(redactString('token=xyz')).toBe('token=***')
  })

  it('does NOT redact standard quoted JSON values (known mirror limitation)', () => {
    // The value pattern `[^\s",}\]]+` stops at the opening quote, so
    // `"token": "xyz"` is left untouched. This mirrors the Rust-side
    // `utils::redact::redact_sensitive()` behavior — callers should pass
    // stringified `key=value` forms, not pretty-printed JSON.
    expect(redactString('"token": "xyz"')).toBe('"token": "xyz"')
  })

  it('redacts authorization header value up to first whitespace', () => {
    // Pattern `[^\s",}\]]+` matches only the token before the space.
    expect(redactString('authorization: Bearer secret-token')).toBe(
      'authorization: *** secret-token'
    )
  })

  it('redacts password assignment', () => {
    expect(redactString('password = hunter2')).toBe('password = ***')
  })
})

describe('redactString — 边界用例', () => {
  it('redacts multiple sensitive keys on one line', () => {
    const input = 'api_key=abc token=xyz password=pw'
    const out = redactString(input)
    expect(out).toBe('api_key=*** token=*** password=***')
    expect(out).not.toContain('abc')
    expect(out).not.toContain('xyz')
    expect(out).not.toContain('pw')
  })

  it('leaves non-sensitive strings untouched', () => {
    expect(redactString('theme=dark username=alice')).toBe(
      'theme=dark username=alice'
    )
  })

  it('returns empty string unchanged', () => {
    expect(redactString('')).toBe('')
  })

  it('redacts hyphenated key variant (access-token)', () => {
    expect(redactString('access-token: leaked')).toBe('access-token: ***')
  })

  it('redacts underscore key variant (api_key / refresh_token)', () => {
    expect(redactString('refresh_token=rt-99')).toBe('refresh_token=***')
  })

  it('redacts cookie key', () => {
    expect(redactString('cookie=sessionid-123')).toBe('cookie=***')
  })

  it('redacts secret key', () => {
    expect(redactString('secret: topsecret')).toBe('secret: ***')
  })

  it('is case-insensitive on key name', () => {
    expect(redactString('API_KEY=UPPER')).toBe('API_KEY=***')
  })

  it('does NOT redact quoted JSON values (known mirror limitation)', () => {
    expect(redactString('"authorization":"Bearer x"')).toBe(
      '"authorization":"Bearer x"'
    )
  })
})

describe('isSensitiveKey — 正向用例', () => {
  it('identifies password as sensitive', () => {
    expect(isSensitiveKey('password')).toBe(true)
  })

  it('identifies authorization as sensitive', () => {
    expect(isSensitiveKey('authorization')).toBe(true)
  })

  it('returns false for non-sensitive key', () => {
    expect(isSensitiveKey('theme')).toBe(false)
  })
})

describe('isSensitiveKey — 边界用例', () => {
  it('matches standalone token', () => {
    expect(isSensitiveKey('token')).toBe(true)
  })

  it('does NOT match plural tokens', () => {
    expect(isSensitiveKey('tokens')).toBe(false)
  })

  it('matches hyphenated access-token', () => {
    expect(isSensitiveKey('access-token')).toBe(true)
  })

  it('matches underscore api_key', () => {
    expect(isSensitiveKey('api_key')).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(isSensitiveKey('TOKEN')).toBe(true)
    expect(isSensitiveKey('Api_Key')).toBe(true)
  })

  it('returns false for empty string', () => {
    expect(isSensitiveKey('')).toBe(false)
  })

  it('does NOT match substring inside longer key', () => {
    // refresh_token is sensitive, but "my_token_value" is not a pure key
    expect(isSensitiveKey('my_token_value')).toBe(false)
  })
})

describe('redactObject — 正向用例', () => {
  it('replaces sensitive key value with *** at top level', () => {
    expect(redactObject({ password: 'hunter2', theme: 'dark' })).toEqual({
      password: '***',
      theme: 'dark',
    })
  })

  it('recurses into nested objects', () => {
    const input = {
      user: 'alice',
      creds: { api_key: 'abc', nested: { token: 'xyz' } },
    }
    expect(redactObject(input)).toEqual({
      user: 'alice',
      creds: { api_key: '***', nested: { token: '***' } },
    })
  })

  it('redacts string values via redactString', () => {
    expect(redactObject('api_key=abc123')).toBe('api_key=***')
  })
})

describe('redactObject — 边界用例', () => {
  it('maps over arrays element-by-element', () => {
    expect(redactObject([{ token: 'a' }, { theme: 'dark' }])).toEqual([
      { token: '***' },
      { theme: 'dark' },
    ])
  })

  it('returns null unchanged', () => {
    expect(redactObject(null)).toBe(null)
  })

  it('returns primitive numbers unchanged', () => {
    expect(redactObject(42)).toBe(42)
  })

  it('returns primitive booleans unchanged', () => {
    expect(redactObject(true)).toBe(true)
  })

  it('returns empty object unchanged', () => {
    expect(redactObject({})).toEqual({})
  })

  it('redacts sensitive keys nested inside array of objects', () => {
    const input = [{ password: 'a' }, { password: 'b' }]
    expect(redactObject(input)).toEqual([
      { password: '***' },
      { password: '***' },
    ])
  })

  it('does not mutate the original input', () => {
    const original = { password: 'secret', keep: 'me' }
    const snapshot = JSON.parse(JSON.stringify(original))
    redactObject(original)
    expect(original).toEqual(snapshot)
  })
})
