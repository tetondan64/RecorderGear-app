import { useState } from 'react';

// Simple state management for P0 - will be replaced with proper state management in later phases
export type AppSettings = {
  enableMocks: boolean;
  themeMode: 'light' | 'dark' | 'system';
};

export const useAppStore = () => {
  const [settings, setSettings] = useState<AppSettings>({
    enableMocks: true,
    themeMode: 'system',
  });

  const updateSetting = <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => {
    setSettings(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  return {
    settings,
    updateSetting,
  };
};
