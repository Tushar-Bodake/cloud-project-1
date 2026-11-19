import { collection, doc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore'
import { auth, db } from '../firebase/firebase'
import { publicKeyFromBase64, unwrapDek, wrapDek } from '../encryption/crypto'

export async function shareFile(fileId: string, ownerPrivateKey: CryptoKey, recipientEmail: string) {
  const user = auth.currentUser
  if (!user) throw new Error('Sign in required')
  const normalizedEmail = recipientEmail.trim().toLowerCase()
  const recipientSnapshot = await getDocs(query(collection(db, 'users'), where('email', '==', normalizedEmail)))
  if (recipientSnapshot.empty) throw new Error('No registered SecureCloud user found for that email')

  const recipient = recipientSnapshot.docs[0].data()
  if (recipient.uid === user.uid) throw new Error('You cannot share a file with yourself')
  const accessId = `${recipient.uid}_${fileId}`
  const existing = await getDocs(query(collection(db, 'fileAccess'), where('fileId', '==', fileId), where('recipientId', '==', recipient.uid)))
  if (!existing.empty && existing.docs[0].data().status === 'active') throw new Error('This file is already shared with that user')

  const ownerAccess = await getDocs(query(collection(db, 'fileAccess'), where('fileId', '==', fileId), where('recipientId', '==', user.uid), where('status', '==', 'active')))
  if (ownerAccess.empty) throw new Error('You do not have active access to share this file')
  const ownerWrappedDek = ownerAccess.docs[0].data().wrappedDEK as string
  const dek = await unwrapDek(ownerWrappedDek, ownerPrivateKey)
  const recipientPublicKey = await publicKeyFromBase64(recipient.publicKey)
  const wrappedForRecipient = await wrapDek(dek, recipientPublicKey)

  await setDoc(doc(db, 'fileAccess', accessId), {
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
    details: { recipientEmail: recipientEmail.trim().toLowerCase(), recipientId: recipient.uid },
  })
}

export async function revokeFileAccess(fileId: string, recipientId: string) {
  const user = auth.currentUser
  if (!user) throw new Error('Sign in required')
  await updateDoc(doc(db, 'fileAccess', `${recipientId}_${fileId}`), {
    status: 'revoked',
    revokedAt: serverTimestamp(),
  })
  await setDoc(doc(db, 'activityLogs', crypto.randomUUID()), {
    userId: user.uid,
    fileId,
    activityType: 'REVOKE',
    timestamp: serverTimestamp(),
    details: { recipientId },
  })
}
