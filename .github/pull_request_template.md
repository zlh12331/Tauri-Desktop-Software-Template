## Description

<!-- Brief description of what this PR does -->

## Type of Change

- [ ] feat: New feature
- [ ] fix: Bug fix
- [ ] docs: Documentation change
- [ ] style: Code style change (formatting, etc.)
- [ ] refactor: Code refactoring
- [ ] perf: Performance improvement
- [ ] test: Test addition or correction
- [ ] build: Build system or dependency change
- [ ] ci: CI configuration change
- [ ] chore: Other change (doesn't modify src or test files)
- [ ] revert: Revert previous commit

## Checklist

Run `npm run check:all` locally before submitting — it covers every gate below.

- [ ] My commit messages follow [Conventional Commits](https://conventionalcommits.org/)
- [ ] TypeScript types are correct (`npm run typecheck`)
- [ ] ESLint passes with zero warnings (`npm run lint`)
- [ ] Spell check passes (`npm run cspell:check`)
- [ ] Architecture rules pass (`npm run ast:lint`)
- [ ] Code is formatted (`npm run format:check`)
- [ ] i18n catalogs are consistent (`npm run i18n:check`)
- [ ] Unit tests pass (`npm run test:run`)
- [ ] Rust code is formatted and linted (`npm run rust:fmt:check` && `npm run rust:clippy`)
- [ ] Rust has no unused dependencies (`npm run rust:machete`)
- [ ] Rust tests pass (`npm run rust:test`)
- [ ] E2E tests pass (`npm run e2e` — CI-only, needs dev server)
- [ ] I have added tests for new functionality
- [ ] I have updated documentation if needed (README test counts, docs/)
- [ ] No new warnings or errors introduced

## Testing

<!-- Describe how you tested your changes -->

## Screenshots (if applicable)

<!-- Add screenshots for UI changes -->
