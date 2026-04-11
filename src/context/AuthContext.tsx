import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '@/src/firebase';
import { UserProfile } from '@/src/types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAuthReady: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAuthReady: false
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        // Immediate check for admin email to prevent student redirect during profile load
        const isAdminEmail = firebaseUser.email === 'mehulsharma31253@gmail.com';
        
        // Listen to profile changes
        const userPath = `users/${firebaseUser.uid}`;
        const unsubscribeProfile = onSnapshot(doc(db, 'users', firebaseUser.uid), (docSnap) => {
          if (docSnap.exists()) {
            const profileData = docSnap.data() as UserProfile;
            setProfile(profileData);
          } else {
            // If it's the admin email, we can synthesize a temporary profile
            if (isAdminEmail) {
              setProfile({
                uid: firebaseUser.uid,
                email: firebaseUser.email || '',
                displayName: firebaseUser.displayName || 'Admin',
                role: 'admin',
                createdAt: new Date().toISOString()
              });
            } else {
              setProfile(null);
            }
          }
          setLoading(false);
          setIsAuthReady(true);
        }, (error) => {
          if (auth.currentUser) {
            console.error("Profile fetch error:", error);
            try {
              handleFirestoreError(error, OperationType.GET, userPath);
            } catch (e) {}
          }
          setLoading(false);
          setIsAuthReady(true);
        });
        
        return () => unsubscribeProfile();
      } else {
        setProfile(null);
        setLoading(false);
        setIsAuthReady(true);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAuthReady }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
