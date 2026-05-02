import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const lightTheme = {
  background: '#FFFFFF',
  surface: '#F5F5F5',
  surfaceDarker: '#EEEEEE',
  text: '#000000',
  textSecondary: '#666666',
  border: '#DDDDDD',
  card: '#FFFFFF',
};

export const darkTheme = {
  background: '#000000',
  surface: '#111111',
  surfaceDarker: '#1A1A1A',
  text: '#FFFFFF',
  textSecondary: '#888888',
  border: '#333333',
  card: '#0D0D0D',
};

type ThemeContextType = {
  isDarkMode: boolean;
  theme: typeof darkTheme;
  accentColor: string;
  toggleDarkMode: () => void;
  setAccentColor: (color: string) => void;
};

const ThemeContext = createContext<ThemeContextType | null>(null);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [accentColor, setAccentColorState] = useState('#1DB954');

  useEffect(() => {
    AsyncStorage.getItem('theme_mode').then(mode => {
      if (mode === 'light') setIsDarkMode(false);
    });
    AsyncStorage.getItem('theme_accent').then(color => {
      if (color) setAccentColorState(color);
    });
  }, []);

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    AsyncStorage.setItem('theme_mode', newMode ? 'dark' : 'light');
  };

  const setAccentColor = (color: string) => {
    setAccentColorState(color);
    AsyncStorage.setItem('theme_accent', color);
  };

  const theme = isDarkMode ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ isDarkMode, theme, accentColor, toggleDarkMode, setAccentColor }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};
