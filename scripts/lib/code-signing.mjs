/**
 * Wiring between the certificate a release imports and the two config fields the
 * bundler actually reads.
 *
 * `tauri-bundler` signs macOS from `bundle.macOS.signingIdentity` and Windows from
 * `bundle.windows.certificateThumbprint`. A workflow that imports a certificate into
 * a keychain and exports a differently-named environment variable names nothing the
 * bundler looks at: the release ships ad-hoc or unsigned, every check is green, and
 * the person who bought the certificate has no way to learn it. So this module is
 * deliberately narrow — it edits those two fields and refuses when it cannot find
 * them, instead of rewriting the config wholesale and hoping the merge is deep.
 *
 * Kept free of fs/process so the resolution and the text surgery are testable on
 * their own; `scripts/configure-code-signing.mjs` is the CLI.
 */

/** Where each value comes from and what it must be written into. */
const FIELDS = [
  {
    key: 'identity',
    label: 'bundle.macOS.signingIdentity',
    // The field name is unique in this config, but anchor the value anyway so a
    // future duplicate key cannot make the first match win by accident.
    re: /("signingIdentity"\s*:\s*)("(?:[^"\\]|\\.)*"|null)/,
  },
  {
    key: 'thumbprint',
    label: 'bundle.windows.certificateThumbprint',
    re: /("certificateThumbprint"\s*:\s*)("(?:[^"\\]|\\.)*"|null)/,
  },
]

/**
 * Decide what the bundler should be told, from certificate intent and what was
 * actually found.
 *
 * A secret that yields no usable identity is the silent case worth killing: the
 * operator asked for signing and would otherwise receive an ad-hoc bundle.
 */
export function resolveSigning({
  appleSecret = false,
  windowsSecret = false,
  identity = '',
  thumbprint = '',
}) {
  const problems = []
  if (appleSecret && !identity) {
    problems.push(
      'APPLE_CERTIFICATE is set but no codesigning identity was found in the keychain — ' +
        'the bundle would ship ad-hoc anyway, so the release stops here'
    )
  }
  if (windowsSecret && !thumbprint) {
    problems.push(
      'WINDOWS_CERTIFICATE is set but no certificate thumbprint was exported — ' +
        'signtool would not run, so the release stops here'
    )
  }
  return {
    identity: identity || null,
    thumbprint: thumbprint || null,
    problems,
  }
}

/**
 * Write the resolved values into the config source, field by field.
 *
 * `changed` names what moved, so the caller can log exactly what a reviewer would
 * otherwise have to diff. A value to apply whose field is missing is a problem: the
 * alternative is a silent no-op that reads as success.
 */
export function applySigningText(source, resolved) {
  let text = source
  const changed = []
  const problems = []

  for (const field of FIELDS) {
    const value = resolved[field.key]
    if (!value) continue
    const match = field.re.exec(text)
    if (!match) {
      problems.push(
        `${field.label} is not present in this config, refusing to guess where it belongs`
      )
      continue
    }
    text = text.replace(field.re, `$1${JSON.stringify(value)}`)
    // Report the token as it was written, quotes and all: `null` and `"-"` read
    // differently in a log line, and the whole point of the line is that a reviewer
    // can see which default moved.
    changed.push(`${field.label}: ${match[2]} → ${JSON.stringify(value)}`)
  }

  return { text, changed, problems }
}
