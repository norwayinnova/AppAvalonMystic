import { initializeApp } from 'firebase/app';
import { getFirestore, initializeFirestore, persistentLocalCache, memoryLocalCache } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: "AIzaSyD8RcGHihBLmx2rU8VEa4ede5r6DDFiHRE",
  authDomain: "newagain-80e25.firebaseapp.com",
  projectId: "newagain-80e25",
  storageBucket: "newagain-80e25.firebasestorage.app",
  messagingSenderId: "695025623906",
  appId: "1:695025623906:web:1e048ab5bd60ac3e95c23b",
  measurementId: "G-V203ED9TR5"
};

export const app = initializeApp(firebaseConfig);

// Configurar base de datos con Modo Sótano (Offline Persistence)
export const db = initializeFirestore(app, {
  localCache: Platform.OS === 'web' ? persistentLocalCache() : memoryLocalCache()
});

export const storage = getStorage(app);
