import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/src/firebase';
import { SystemSettings } from '@/src/types';

interface SettingsContextType {
  settings: SystemSettings | null;
  loading: boolean;
  updateSettings: (newSettings: Partial<SystemSettings>) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const DEFAULT_SETTINGS: SystemSettings = {
  id: 'system',
  proctoring: {
    faceMissingTimeout: 5,
    maxTabSwitches: 3,
    enableFaceDetection: true,
    enableTabSwitchDetection: true,
    enableMultipleFacesDetection: true,
  },
  notifications: {
    emailAlertsEnabled: true,
    dailySummaryEnabled: false,
    newUserAlertsEnabled: true,
  },
  branding: {
    siteName: 'ProctorLearn AI',
    primaryColor: '#4318ff',
  },
  updatedAt: new Date().toISOString(),
};

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const settingsRef = doc(db, 'settings', 'system');

    // Initialize settings if they don't exist
    const initSettings = async () => {
      try {
        const docSnap = await getDoc(settingsRef);
        if (!docSnap.exists()) {
          // Only attempt to set if we are likely an admin or if it's the first time
          // This might still fail for non-admins, which is fine
          await setDoc(settingsRef, DEFAULT_SETTINGS);
        }
      } catch (err: any) {
        // Ignore permission errors during initialization for non-admins
        if (err.code !== 'permission-denied') {
          console.warn("Settings initialization skipped or failed:", err.message);
        }
      }
    };

    initSettings();

    const unsubscribe = onSnapshot(settingsRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data() as SystemSettings;
        setSettings(data);
        
        // Apply primary color to CSS variables
        if (data.branding?.primaryColor) {
          document.documentElement.style.setProperty('--primary-color', data.branding.primaryColor);
          // Simple darken for hover state (could be more sophisticated)
          document.documentElement.style.setProperty('--primary-color-hover', data.branding.primaryColor + 'cc');
        }
      } else {
        setSettings(DEFAULT_SETTINGS);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error listening to settings:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const updateSettings = async (newSettings: Partial<SystemSettings>) => {
    const settingsRef = doc(db, 'settings', 'system');
    const updatedData = {
      ...settings,
      ...newSettings,
      updatedAt: new Date().toISOString(),
    };
    await setDoc(settingsRef, updatedData, { merge: true });
  };

  return (
    <SettingsContext.Provider value={{ settings, loading, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
