import { doc, getDoc, getDocs, collection, collectionGroup, query, where, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { getBytes, ref, uploadBytes } from 'firebase/storage'
import { auth, db, storage } from '../firebase/firebase'
import { BLOCK_SIZE, encryptBlock, sha256Hex, wrapDek, unwrapDek, decryptBlock } from '../encryption/crypto'
import { notifyDataChanged } from '../events/dataChange'

export type SecureFileManifest = {
  fileId: string
  originalFileName: string
  originalFileSize: number
  mimeType: string
  blockCount: number
  wholeFileHash: string
  blocks: Array<{ blockNumber: number; encryptedHash: string; nonce: string; encryptedSize: number }>
}

export type SecureFileRecord = {
  fileId: string
  ownerId: string
  encryptedFileName: string
  originalFileSize: number
  mimeType: string
  blockCount: number
  storagePath: string
  manifestPath: string
  wholeFileHash: string
  createdAt?: unknown
  updatedAt?: unknown
  trashed?: boolean
  starred?: boolean
  displayName?: string
}

function storagePath(ownerId: string, fileId: string, blockNumber: number) {
  return `users/${ownerId}/files/${fileId}/block_${blockNumber.toString().padStart(5, '0')}.enc`
}

export async function uploadEncryptedFile(file: File, ownerKey: CryptoKey): Promise<SecureFileRecord> {
  const user = auth.currentUser
  if (!user) throw new Error('Sign in required')
  if (!window.crypto?.subtle) throw new Error('This browser does not support Web Crypto')

  const fileId = crypto.randomUUID()
  const dek = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
  const fileBlocks: Uint8Array[] = []
  const manifestBlocks: SecureFileManifest['blocks'] = []

  for (let offset = 0, blockNumber = 0; offset < file.size; offset += BLOCK_SIZE, blockNumber++) {
    const plaintext = new Uint8Array(await file.slice(offset, Math.min(offset + BLOCK_SIZE, file.size)).arrayBuffer())
    const encrypted = await encryptBlock(fileId, blockNumber, plaintext, dek)
    const hash = await sha256Hex(encrypted.ciphertext)
    manifestBlocks.push({ blockNumber, encryptedHash: hash, nonce: encrypted.nonce, encryptedSize: encrypted.ciphertext.length })
    fileBlocks.push(encrypted.ciphertext)
  }

  const wholeFilePlaintext = new Uint8Array(await file.arrayBuffer())
  const wholeFileHash = await sha256Hex(wholeFilePlaintext)
  const manifest: SecureFileManifest = {
    fileId,
    originalFileName: file.name,
    originalFileSize: file.size,
    mimeType: file.type || 'application/octet-stream',
    blockCount: manifestBlocks.length,
    wholeFileHash,
    blocks: manifestBlocks,
  }

  for (let blockNumber = 0; blockNumber < fileBlocks.length; blockNumber++) {
    await uploadBytes(ref(storage, storagePath(user.uid, fileId, blockNumber)), fileBlocks[blockNumber])
  }

  const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest))
  const manifestPath = `users/${user.uid}/files/${fileId}/manifest.enc`
  await uploadBytes(ref(storage, manifestPath), manifestBytes)
  const wrappedDEK = await wrapDek(dek, ownerKey)

  const record: SecureFileRecord = {
    fileId,
    ownerId: user.uid,
    encryptedFileName: file.name,
    originalFileSize: file.size,
    mimeType: file.type || 'application/octet-stream',
    blockCount: manifestBlocks.length,
    storagePath: `users/${user.uid}/files/${fileId}`,
    manifestPath,
    wholeFileHash,
    trashed: false,
    starred: false,
  }

  await setDoc(doc(db, 'files', fileId), { ...record, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
  await setDoc(doc(db, 'files', fileId, 'fileAccess', user.uid), {
    fileId,
    ownerId: user.uid,
    recipientId: user.uid,
    wrappedDEK,
    permission: 'owner',
    status: 'active',
    sharedAt: serverTimestamp(),
  })
  await setDoc(doc(db, 'activityLogs', crypto.randomUUID()), {
    userId: user.uid,
    fileId,
    activityType: 'UPLOAD',
    timestamp: serverTimestamp(),
    details: { fileName: file.name, size: file.size },
  })
  notifyDataChanged()
  return record
}

export async function listOwnedFiles(): Promise<SecureFileRecord[]> {
  const user = auth.currentUser
  if (!user) return []
  const snapshot = await getDocs(query(collection(db, 'files'), where('ownerId', '==', user.uid)))
  return snapshot.docs
    .map(item => item.data() as SecureFileRecord)
    .filter(file => !file.trashed)
    .sort((a, b) => timestampMillis(b.createdAt) - timestampMillis(a.createdAt))
}

function timestampMillis(timestamp: unknown) {
  if (timestamp instanceof Date) return timestamp.getTime()
  if (timestamp && typeof timestamp === 'object' && 'toMillis' in timestamp && typeof timestamp.toMillis === 'function') {
    return timestamp.toMillis()
  }
  return 0
}

export async function listSharedFiles(): Promise<SecureFileRecord[]> {
  const user = auth.currentUser
  if (!user) return []
  const accessSnapshot = await getDocs(query(collectionGroup(db, 'fileAccess'), where('recipientId', '==', user.uid), where('status', '==', 'active')))
  const records: SecureFileRecord[] = []
  for (const access of accessSnapshot.docs) {
    if (access.data().permission === 'owner') continue
    const file = await getDoc(doc(db, 'files', access.data().fileId))
    if (file.exists() && !file.data().trashed) records.push(file.data() as SecureFileRecord)
  }
  return records
}

export type ActivityRecord = {
  activityId: string
  userId: string
  fileId: string
  activityType: string
  timestamp?: { toDate?: () => Date } | Date
  details?: Record<string, unknown>
}

export async function listRecentActivity(): Promise<ActivityRecord[]> {
  const user = auth.currentUser
  if (!user) return []
  const snapshot = await getDocs(query(collection(db, 'activityLogs'), where('userId', '==', user.uid)))
  return snapshot.docs
    .map(item => ({ activityId: item.id, ...item.data() } as ActivityRecord))
    .sort((a, b) => activityDate(b.timestamp).getTime() - activityDate(a.timestamp).getTime())
}

function activityDate(timestamp: ActivityRecord['timestamp']) {
  if (timestamp instanceof Date) return timestamp
  if (timestamp && typeof timestamp.toDate === 'function') return timestamp.toDate()
  return new Date(0)
}

export async function downloadEncryptedFile(file: SecureFileRecord, privateKey: CryptoKey) {
  const user = auth.currentUser
  if (!user) throw new Error('Sign in required')
  const access = await getDoc(doc(db, 'files', file.fileId, 'fileAccess', user.uid))
  if (!access.exists() || access.data().status !== 'active') throw new Error('You do not have active access to this file')

  const manifestBytes = new Uint8Array(await getBytes(ref(storage, file.manifestPath)))
  const manifest = JSON.parse(new TextDecoder().decode(manifestBytes)) as SecureFileManifest
  if (manifest.fileId !== file.fileId || manifest.blockCount !== manifest.blocks.length) throw new Error('Manifest integrity validation failed')

  const dek = await unwrapDek(access.data().wrappedDEK, privateKey)
  const plaintextBlocks: Uint8Array[] = []
  for (const block of manifest.blocks) {
    const encryptedBytes = new Uint8Array(await getBytes(ref(storage, storagePath(file.ownerId, file.fileId, block.blockNumber))))
    const actualHash = await sha256Hex(encryptedBytes)
    if (actualHash !== block.encryptedHash) throw new Error(`Integrity verification failed for block ${block.blockNumber}`)
    if (encryptedBytes.length !== block.encryptedSize) throw new Error(`Block ${block.blockNumber} has an invalid size`)
    plaintextBlocks.push(await decryptBlock(file.fileId, block.blockNumber, block.nonce, encryptedBytes, dek))
  }

  const plaintext = new Uint8Array(manifest.originalFileSize)
  let offset = 0
  for (const block of plaintextBlocks) {
    plaintext.set(block, offset)
    offset += block.length
  }
  if (offset !== manifest.originalFileSize) throw new Error('Decrypted file size does not match manifest')
  if (await sha256Hex(plaintext) !== manifest.wholeFileHash) throw new Error('Whole-file integrity verification failed')

  const downloadUrl = URL.createObjectURL(new Blob([plaintext], { type: manifest.mimeType }))
  const anchor = document.createElement('a')
  anchor.href = downloadUrl
  anchor.download = manifest.originalFileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(downloadUrl)
  await setDoc(doc(db, 'activityLogs', crypto.randomUUID()), {
    userId: user.uid,
    fileId: file.fileId,
    activityType: 'DOWNLOAD',
    timestamp: serverTimestamp(),
    details: { fileName: manifest.originalFileName, integrityVerified: true },
  })
  notifyDataChanged()
}

export async function toggleStar(fileId: string, starred: boolean) {
  await updateDoc(doc(db, 'files', fileId), { starred, updatedAt: serverTimestamp() })
  const user = auth.currentUser
  if (user) {
    await setDoc(doc(db, 'activityLogs', crypto.randomUUID()), {
      userId: user.uid,
      fileId,
      activityType: starred ? 'STAR' : 'UNSTAR',
      timestamp: serverTimestamp(),
      details: {},
    })
  }
  notifyDataChanged()
}

export async function moveToTrash(fileId: string) {
  await updateDoc(doc(db, 'files', fileId), { trashed: true, updatedAt: serverTimestamp() })
  const user = auth.currentUser
  if (user) {
    await setDoc(doc(db, 'activityLogs', crypto.randomUUID()), {
      userId: user.uid,
      fileId,
      activityType: 'TRASH',
      timestamp: serverTimestamp(),
      details: {},
    })
  }
  notifyDataChanged()
}

export async function restoreFile(fileId: string) {
  await updateDoc(doc(db, 'files', fileId), { trashed: false, updatedAt: serverTimestamp() })
  const user = auth.currentUser
  if (user) {
    await setDoc(doc(db, 'activityLogs', crypto.randomUUID()), {
      userId: user.uid,
      fileId,
      activityType: 'RESTORE',
      timestamp: serverTimestamp(),
      details: {},
    })
  }
  notifyDataChanged()
}
