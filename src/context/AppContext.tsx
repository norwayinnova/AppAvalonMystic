import React, { createContext, useState, useContext, ReactNode, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

type Role = 'admin' | 'management' | 'team' | 'cliente' | null;
type ToastType = 'success' | 'error' | 'info';

interface AppContextType {
  role: Role;
  teamName: string | null;
  loginAsAdmin: () => void;
  loginAsManagement: () => void;
  loginAsTeam: (teamName: string) => void;
  loginAsClient: () => void;
  logout: () => void;
  showToast: (msg: string, type?: ToastType) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [role, setRole] = useState<Role>(null);
  const [teamName, setTeamName] = useState<string | null>(null);
  
  // Toast State
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<ToastType>('success');
  const slideAnim = useRef(new Animated.Value(-100)).current;

  const loginAsAdmin = () => { setRole('admin'); setTeamName(null); };
  const loginAsManagement = () => { setRole('management'); setTeamName(null); };
  const loginAsTeam = (name: string) => { setRole('team'); setTeamName(name); };
  const loginAsClient = () => { setRole('cliente'); setTeamName(null); };
  const logout = () => { setRole(null); setTeamName(null); };

  const showToast = (msg: string, type: ToastType = 'success') => {
    setToastMsg(msg);
    setToastType(type);
    Animated.spring(slideAnim, {
      toValue: 50,
      useNativeDriver: true,
      speed: 12
    }).start();

    setTimeout(() => {
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true
      }).start();
    }, 3000);
  };

  return (
    <AppContext.Provider value={{ role, teamName, loginAsAdmin, loginAsManagement, loginAsTeam, loginAsClient, logout, showToast }}>
      {children}
      {toastMsg ? (
        <Animated.View style={[
          styles.toastContainer, 
          { transform: [{ translateY: slideAnim }] },
          toastType === 'success' ? styles.toastSuccess : toastType === 'error' ? styles.toastError : styles.toastInfo
        ]}>
          <Text style={styles.toastText}>{toastMsg}</Text>
        </Animated.View>
      ) : null}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) throw new Error('useAppContext must be used within an AppProvider');
  return context;
};

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 10,
  },
  toastSuccess: { backgroundColor: '#2ecc71' },
  toastError: { backgroundColor: '#e74c3c' },
  toastInfo: { backgroundColor: '#3498db' },
  toastText: { color: '#fff', fontWeight: 'bold', fontSize: 14 }
});
