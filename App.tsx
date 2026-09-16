import { StatusBar } from 'expo-status-bar';
import AppNavigator from './src/navigation/AppNavigator';

import { AppProvider } from './src/context/AppContext';

export default function App() {
  return (
    <AppProvider>
      <AppNavigator />
      <StatusBar style="auto" />
    </AppProvider>
  );
}
