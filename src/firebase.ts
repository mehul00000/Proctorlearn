import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  GoogleAuthProvider, 
  signInWithPopup 
} from 'firebase/auth';

import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  getDocFromServer 
} from 'firebase/firestore';

// 🔥 Firebase Config (ENV based)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// ✅ Initialize ONLY ONCE
const app = initializeApp(firebaseConfig);

// ✅ Export ONLY ONCE
export const auth = getAuth(app);
export const db = getFirestore(app);

// =========================
// 🔍 Connection Test
// =========================
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('offline')) {
      console.error("Firebase connection issue. Check config.");
    }
  }
}
testConnection();

// =========================
// ⚠️ Error Handler
// =========================
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    user: {
      uid: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    }
  };

  console.error('Firestore Error:', errInfo);
  throw new Error(JSON.stringify(errInfo));
}

// =========================
// 🔐 AUTH FUNCTIONS
// =========================

export const loginWithEmail = async (email: string, pass: string) => {
  const result = await signInWithEmailAndPassword(auth, email, pass);
  return result.user;
};

export const registerWithEmail = async (email: string, pass: string, displayName: string) => {
  const result = await createUserWithEmailAndPassword(auth, email, pass);
  const user = result.user;

  const isAdmin = email.toLowerCase() === 'mehulsharma31253@gmail.com';

  try {
    await setDoc(doc(db, 'users', user.uid), {
      uid: user.uid,
      email: user.email,
      displayName,
      role: isAdmin ? 'admin' : 'student',
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}`);
  }

  return user;
};

export const logout = () => {
  sessionStorage.removeItem('otp_verified');
  return signOut(auth);
};

export const signInWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  const user = result.user;

  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    const isAdmin = user.email?.toLowerCase() === 'mehulsharma31253@gmail.com';

    await setDoc(userRef, {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || 'Google User',
      role: isAdmin ? 'admin' : 'student',
      createdAt: new Date().toISOString()
    });
  }

  return user;
};
