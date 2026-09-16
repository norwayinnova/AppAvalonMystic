import { initializeApp } from 'firebase/app';
import { getFirestore, initializeFirestore, persistentLocalCache, memoryLocalCache } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: "AIzaSyAyZYx90mRTu9SfYkmue4oraMiOx-Vfldw",
  authDomain: "avalonmystic-707e6.firebaseapp.com",
  projectId: "avalonmystic-707e6",
  storageBucket: "avalonmystic-707e6.firebasestorage.app",
  messagingSenderId: "197654005050",
  appId: "1:197654005050:web:9e860dae88e856d6c0fc03"
};

export const app = initializeApp(firebaseConfig);

// Configurar base de datos con Modo Sótano (Offline Persistence)
export const db = initializeFirestore(app, {
  localCache: Platform.OS === 'web' ? persistentLocalCache() : memoryLocalCache()
});

export const storage = getStorage(app);
