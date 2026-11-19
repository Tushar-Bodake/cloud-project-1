import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { onAuthStateChanged, signOut, type User } from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../services/firebase/firebase'
import { decryptPrivateKey, encryptPrivateKey, generateRsaKeyPair, publicKeyToPem } from '../services/encryption/crypto'

export type KeyMaterial = CryptoKeyPair

type AuthContextValue = {
  user: User | null
  loading: boolean
  keyPair: KeyMaterial | null
  unlockKeys: (password: string) => Promise<void>
  clearKeys: () => Promise<void>
  createUserProfile: (displayName: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [keyPair, setKeyPair] = useState<KeyMaterial | null>(null)

  useEffect(() => onAuthStateChanged(auth, currentUser => {
    setUser(currentUser)
    setKeyPair(null)
    setLoading(false)
  }), [])

  const unlockKeys = async (password: string) => {
    if (!auth.currentUser) throw new Error('Not signed in')
    const snapshot = await getDoc(doc(db, 'users', auth.currentUser.uid))
    if (!snapshot.exists()) throw new Error('Cryptographic profile not found')
    const record = snapshot.data()
    if (!record.encryptedPrivateKey || !record.keyEncryptionSalt) throw new Error('Private-key recovery data is missing')
    const privateKey = await decryptPrivateKey(password, record.keyEncryptionSalt, record.encryptedPrivateKey)
    const publicKey = await crypto.subtle.importKey('spki', Uint8Array.from(atob(record.publicKey), c => c.charCodeAt(0)), { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['encrypt'])
    setKeyPair({ publicKey, privateKey })
  }

  const createUserProfile = async (displayName: string, password: string) => {
    if (!auth.currentUser) throw new Error('Not signed in')
    const pair = await generateRsaKeyPair()
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const encryptedPrivateKey = await encryptPrivateKey(password, salt, pair.privateKey)
    await setDoc(doc(db, 'users', auth.currentUser.uid), {
      uid: auth.currentUser.uid,
      displayName,
      email: auth.currentUser.email,
      publicKey: await publicKeyToPem(pair.publicKey),
      encryptedPrivateKey,
      keyEncryptionSalt: btoa(String.fromCharCode(...salt)),
      createdAt: serverTimestamp(),
      storageUsed: 0,
    })
  }

  const clearKeys = async () => setKeyPair(null)
  const logout = async () => {
    setKeyPair(null)
    await signOut(auth)
  }

  const value = useMemo(() => ({ user, loading, keyPair, unlockKeys, clearKeys, createUserProfile, logout }), [user, loading, keyPair])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
