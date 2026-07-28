import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { auth, db, firebaseConfig } from '../../../lib/firebase.js'

// Login user
export async function loginUser(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password)
  return credential.user
}

// Buat akun baru TANPA logout session saat ini (secondary app instance)
export async function createAccountWithoutSignIn(email, password, role, extraData = {}) {
  const secondaryApp = initializeApp(firebaseConfig, 'SecondaryApp_' + Date.now())
  const secondaryAuth = getAuth(secondaryApp)

  try {
    const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password)
    const uid = credential.user.uid

    // Simpan data user ke Firestore
    await setDoc(doc(db, 'users', uid), {
      email,
      role,
      createdAt: new Date().toISOString(),
      ...extraData
    })

    // Cleanup secondary app
    await deleteApp(secondaryApp)
    return uid
  } catch (error) {
    await deleteApp(secondaryApp)
    throw error
  }
}

// Reset Password via Email
export async function resetPassword(email) {
  const { sendPasswordResetEmail } = await import('firebase/auth')
  await sendPasswordResetEmail(auth, email)
}

// Change Password Directly
export async function changeUserPassword(currentPassword, newPassword) {
  const { EmailAuthProvider, reauthenticateWithCredential, updatePassword } = await import('firebase/auth')
  const user = auth.currentUser
  if (!user) throw new Error('User not authenticated')
  
  const credential = EmailAuthProvider.credential(user.email, currentPassword)
  
  // Re-authenticate user to verify current password
  await reauthenticateWithCredential(user, credential)
  
  // Update to new password
  await updatePassword(user, newPassword)
}

// Send verification email to the new email address
export async function changeUserEmail(currentPassword, newEmail) {
  const { EmailAuthProvider, reauthenticateWithCredential, verifyBeforeUpdateEmail } = await import('firebase/auth')
  const user = auth.currentUser
  if (!user) throw new Error('User not authenticated')
  
  const credential = EmailAuthProvider.credential(user.email, currentPassword)
  
  // Re-authenticate user to verify current password
  await reauthenticateWithCredential(user, credential)
  
  // Send verification link instead of direct update
  await verifyBeforeUpdateEmail(user, newEmail)
}
