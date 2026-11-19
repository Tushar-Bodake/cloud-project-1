# Runtime Validation Report

**Generated:** 2026-11-19T14:00:00+05:30  
**Target:** SecureCloud (`C:\Users\HP CENTER\OneDrive\Desktop\cloud-project-1`)

## Summary

| Step | Status | Exit code | Details |
|---|---|---:|---|
| Startup | PASS | n/a | Vite returned HTTP 200; Firebase Auth, Firestore, and Storage emulators reported ready |
| Unit tests | PASS | 0 | 7 cryptography tests passed |
| Production build | PASS | 0 | TypeScript compile and Vite production build succeeded |
| Lint | PASS with warning | 0 | One Fast Refresh export warning remains in `AuthContext.tsx` |
| Browser E2E | FAIL | 1 | 3 passed, 1 failed; sharing flow rejected by Firestore rules |

## Environment

- Node.js: available, v22.20.0
- Docker: unavailable (not required for the Firebase Emulator Suite run)
- Browser E2E: Playwright with Chromium installed
- Application: `http://127.0.0.1:5173`
- Firebase Emulator Suite: Auth `:9099`, Firestore `:8080`, Storage `:9199`

## Test evidence

- `npm test` — 7 passed, exit code 0
- `npm run build` — succeeded, exit code 0 (Vite reports a large JavaScript chunk)
- `npm run lint` — exit code 0, with one Fast Refresh warning
- `npm run test:e2e` — 3 passed, 1 failed, exit code 1

Passing browser journeys:

1. Invalid email/password login is rejected.
2. Registration creates a new, empty workspace with the account’s name.
3. Encrypted upload persists in Firestore and the file downloads back with the original content.

Failing browser journey:

- Sharing a file with another registered user fails with: `Property ownerId is undefined on object. for 'list' @ L15, false for 'list' @ L29`.
- The recipient therefore cannot complete the shared-file journey. Firestore sharing rules need correction and revalidation.

## Gaps

- Sharing and access revocation are not validated as passing behavior.
- No production Firebase project credentials were supplied; tests ran against local emulators only.
- Current UI has no dedicated revoke-access or restore-from-trash controls.

**Overall:** FAIL — the core auth and encrypted upload/download paths pass locally, but the sharing permissions test fails.
