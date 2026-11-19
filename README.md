# SecureCloud

SecureCloud is a privacy-focused encrypted cloud file storage and sharing platform built with React, TypeScript, Vite, Tailwind CSS, Firebase, and Web Crypto.

## Architecture

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, React Router, Lucide React
- **Identity:** Firebase Authentication
- **Metadata and permissions:** Cloud Firestore
- **Encrypted objects:** Firebase Cloud Storage
- **Cryptography:** Web Crypto AES-256-GCM and RSA-OAEP; an audited scrypt implementation protects browser-held private keys
- **Local development:** Firebase Emulator Suite

The encryption boundary is the browser: files are split into 4 MB blocks, AES-GCM encrypts each block with a random nonce and authenticated block metadata, and Firebase receives only encrypted blocks and manifests.

## Phase 1 status

This implementation includes the production UI shell:

- Responsive dashboard, sidebar, top navigation, file views, search, view toggles, starring, and upload dialog
- Login and registration screens
- Dashboard statistics and storage visualization
- Shared, recent, starred, trash, activity, and settings routes
- Firebase, Firestore, Storage, and emulator configuration placeholders

Firebase authentication and cryptography are implemented in later phases rather than presented as simulated production behavior.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a Firebase project and enable Email/password authentication, Cloud Firestore, and Cloud Storage.

3. Copy the environment template:

```bash
copy .env.example .env
```

4. Add the Firebase web configuration values from Firebase Console to `.env`. Never put service-account credentials in frontend source or environment files shipped to the browser.

5. Start the app:

```bash
npm run dev
```

For emulator development:

```bash
firebase emulators:start
```

Set `VITE_USE_FIREBASE_EMULATORS=true` when emulator integration is enabled.

## Validation

```bash
npm run build
npm run lint
```
