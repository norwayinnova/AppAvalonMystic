import React, { useState, useEffect } from 'react';
import { Image, View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
import RoleSelectionScreen from '../screens/RoleSelectionScreen';
import { useAppContext } from '../context/AppContext';
import CalendarScreen from '../screens/CalendarScreen';
import AppointmentsScreen from '../screens/AppointmentsScreen';
import ServicesScreen from '../screens/ServicesScreen';
import ClientsScreen from '../screens/ClientsScreen';
import DashboardScreen from '../screens/DashboardScreen';
import ExpensesScreen from '../screens/ExpensesScreen';
import InventoryScreen from '../screens/InventoryScreen';
import ClientBookingScreen from '../screens/ClientBookingScreen';
import CalculatorScreen from '../screens/CalculatorScreen';
import PromotionsScreen from '../screens/PromotionsScreen';

function LogoTitle() {
  return (
    <View style={styles.logoContainer}>
      <Image
        style={styles.logoImage}
        source={require('../../assets/logo.jpg')}
        resizeMode="contain"
      />
    </View>
  );
}

function CustomTopTabBar({ tabs, activeTab, onTabPress }: { tabs: any[], activeTab: string, onTabPress: (name: string) => void }) {
  return (
    <View style={styles.tabBarWrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabScrollContent}
      >
        {tabs.map((tab) => {
          const isFocused = activeTab === tab.name;
          return (
            <TouchableOpacity
              key={tab.name}
              onPress={() => onTabPress(tab.name)}
              style={[
                styles.tabButton,
                isFocused ? styles.tabButtonActive : styles.tabButtonInactive
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  isFocused ? styles.tabTextActive : styles.tabTextInactive
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

function TopTabs() {
  const { role, teamName } = useAppContext();
  const isAdmin = role === 'admin';
  const isManagement = role === 'management';

  const allTabs = [
    isAdmin ? { name: 'Dashboard', label: '📊 Dashboard', component: DashboardScreen } : null,
    { name: 'Calendar', label: '📅 Calendario', component: CalendarScreen },
    { name: 'Appointments', label: '➕ Nueva Cita', component: AppointmentsScreen },
    isAdmin ? { name: 'Clients', label: '👥 Clientes', component: ClientsScreen } : null,
    (isAdmin || isManagement) ? { name: 'Services', label: '💄 Servicios', component: ServicesScreen } : null,
    isAdmin ? { name: 'Expenses', label: '💸 Gastos', component: ExpensesScreen } : null,
    isAdmin ? { name: 'Calculator', label: '🧮 Calculadora', component: CalculatorScreen } : null,
    isAdmin ? { name: 'Promotions', label: '📢 Promociones', component: PromotionsScreen } : null,
    { name: 'Inventory', label: '📦 Inventario', component: InventoryScreen },
  ].filter(Boolean) as { name: string; label: string; component: React.ComponentType<any> }[];

  const [activeTab, setActiveTab] = useState(allTabs[0]?.name || 'Calendar');

  // Ensure active tab is always valid when role changes
  useEffect(() => {
    if (!allTabs.find(t => t.name === activeTab)) {
      setActiveTab(allTabs[0]?.name || 'Calendar');
    }
  }, [role]);

  const ActiveComponent = allTabs.find(t => t.name === activeTab)?.component;

  return (
    <View style={{ flex: 1 }}>
      <CustomTopTabBar tabs={allTabs} activeTab={activeTab} onTabPress={setActiveTab} />
      <View style={{ flex: 1 }}>
        {ActiveComponent && <ActiveComponent route={{ params: { role, teamName } }} navigation={{}} />}
      </View>
    </View>
  );
}

export default function AppNavigator() {
  const { role, logout, loginAsClient } = useAppContext();

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const url = window.location.href;
      if (url.includes('?reserva') || url.includes('/reserva')) {
        loginAsClient();
      }
    }
  }, []);

  const renderContent = () => {
    if (!role) return <RoleSelectionScreen />;
    if (role === 'cliente') return <ClientBookingScreen />;
    return <TopTabs />;
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Header global */}
      <View style={styles.globalHeader}>
        <LogoTitle />
        {role ? (
          <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
            <Text style={styles.logoutBtnText}>Salir 🔒</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {/* Contenido según rol */}
      <View style={{ flex: 1 }}>
        {renderContent()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  globalHeader: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingTop: Platform.OS === 'ios' ? 44 : 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.08)',
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 3 }
  },
  logoutBtn: {
    padding: 6,
    backgroundColor: 'rgba(233,30,99,0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(233,30,99,0.3)'
  },
  logoutBtnText: { color: '#D48A9A', fontWeight: 'bold', fontSize: 13 },
  logoContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 5 },
  logoImage: { width: 140, height: 40 },
  tabBarWrapper: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.08)',
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 3 }
  },
  tabScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: '100%' as any,
    justifyContent: 'space-around'
  },
  tabButton: {
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent'
  },
  tabButtonActive: { borderBottomColor: '#D48A9A' },
  tabButtonInactive: { borderBottomColor: 'transparent' },
  tabText: { fontWeight: 'bold', fontSize: 13, textAlign: 'center' },
  tabTextActive: { color: '#D48A9A', fontWeight: 'bold' },
  tabTextInactive: { color: '#888888', fontWeight: '600' },
});
