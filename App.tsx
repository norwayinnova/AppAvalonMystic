import { StatusBar } from 'expo-status-bar';
import AppNavigator from './src/navigation/AppNavigator';
import { enableScreens } from 'react-native-screens';

// Disable native screens on web to avoid createScreenFactory crash
enableScreens(false);

import { AppProvider } from './src/context/AppContext';

export default function App() {
  return (
    <AppProvider>
      <AppNavigator />
      <StatusBar style="auto" />
    </AppProvider>
  );
}
