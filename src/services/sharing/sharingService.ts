import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore'
import { auth, db } from '../firebase/firebase'
import { publicKeyFromBase64, unwrapDek, wrapDek } from '../encryption/crypto'
import { notifyDataChanged } from '../events/dataChange'

export async function shareFile(fileId: string, ownerPrivateKey: CryptoKey, recipientEmail: string) {
  const user = auth.currentUser
  if (!user) throw new Error('Sign in required')
  const normalizedEmail = recipientEmail.trim().toLowerCase()
  const recipientSnapshot = await getDocs(query(collection(db, 'users'), where('email', '==', normalizedEmail)))
  if (recipientSnapshot.empty) throw new Error('No registered SecureCloud user found for that email')

  const recipient = recipientSnapshot.docs[0].data()
  if (recipient.uid === user.uid) throw new Error('You cannot share a file with yourself')
  const existing = await getDoc(doc(db, 'files', fileId, 'fileAccess', recipient.uid))
  if (existing.exists() && existing.data().status === 'active') throw new Error('This file is already shared with that user')

  const ownerAccess = await getDoc(doc(db, 'files', fileId, 'fileAccess', user.uid))
  if (!ownerAccess.exists()) throw new Error('You do not have active access to share this file')
  const fileSnapshot = await getDoc(doc(db, 'files', fileId))
  if (!fileSnapshot.exists()) throw new Error('File no longer exists')
  const ownerWrappedDek = ownerAccess.data().wrappedDEK as string
  const dek = await unwrapDek(ownerWrappedDek, ownerPrivateKey)
  const recipientPublicKey = await publicKeyFromBase64(recipient.publicKey)
  const wrappedForRecipient = await wrapDek(dek, recipientPublicKey)

  await setDoc(doc(db, 'files', fileId, 'fileAccess', recipient.uid), {
    fileId,
    ownerId: user.uid,
    recipientId: recipient.uid,
    wrappedDEK: wrappedForRecipient,
    permission: 'viewer',
    sharedAt: serverTimestamp(),
    status: 'active',
  })
  await setDoc(doc(db, 'activityLogs', crypto.randomUUID()), {
    userId: user.uid,
    fileId,
    activityType: 'SHARE',
    timestamp: serverTimestamp(),
    details: { fileName: fileSnapshot.data().encryptedFileName, recipientEmail: normalizedEmail, recipientId: recipient.uid },
  })
  notifyDataChanged()
}

export async function revokeFileAccess(fileId: string, recipientId: string) {
  const user = auth.currentUser
  if (!user) throw new Error('Sign in required')
  const fileSnapshot = await getDoc(doc(db, 'files', fileId))
  await updateDoc(doc(db, 'files', fileId, 'fileAccess', recipientId), {
    status: 'revoked',
    revokedAt: serverTimestamp(),
  })
  await setDoc(doc(db, 'activityLogs', crypto.randomUUID()), {
    userId: user.uid,
    fileId,
    activityType: 'REVOKE',
    timestamp: serverTimestamp(),
    details: { fileName: fileSnapshot.exists() ? fileSnapshot.data().encryptedFileName : 'file', recipientId },
  })
  notifyDataChanged()
}
