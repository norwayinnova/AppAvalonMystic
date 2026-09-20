import React, { useState, useEffect } from 'react';
import { Image, View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform, Modal } from 'react-native';
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
  const [menuOpen, setMenuOpen] = useState(false);
  const activeLabel = tabs.find(t => t.name === activeTab)?.label || 'Menú';

  return (
    <View style={styles.tabBarWrapper}>
      <TouchableOpacity 
        style={styles.menuSelectorBtn} 
        onPress={() => setMenuOpen(true)}
      >
        <Text style={styles.menuSelectorText}>{activeLabel}</Text>
        <Text style={styles.menuSelectorIcon}>▼</Text>
      </TouchableOpacity>

      <Modal
        visible={menuOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setMenuOpen(false)}>
          <View style={styles.menuDropdown}>
            <ScrollView style={{maxHeight: 400}}>
              {tabs.map((tab) => (
                <TouchableOpacity
                  key={tab.name}
                  style={[styles.menuItem, activeTab === tab.name && styles.menuItemActive]}
                  onPress={() => {
                    onTabPress(tab.name);
                    setMenuOpen(false);
                  }}
                >
                  <Text style={[styles.menuItemText, activeTab === tab.name && styles.menuItemTextActive]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
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

  const [activeParams, setActiveParams] = useState<any>({});

  const navigate = (screenName: string, params?: any) => {
    setActiveParams(params || {});
    setActiveTab(screenName);
  };

  return (
    <View style={{ flex: 1 }}>
      <CustomTopTabBar 
        tabs={allTabs} 
        activeTab={activeTab} 
        onTabPress={(name) => {
          setActiveParams({});
          setActiveTab(name);
        }} 
      />
      <View style={{ flex: 1 }}>
        {ActiveComponent && (
          <ActiveComponent 
            route={{ params: { role, teamName, ...activeParams } }} 
            navigation={{ navigate }} 
          />
        )}
      </View>
    </View>
  );
}

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: any}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{flex: 1, padding: 20, justifyContent: 'center', backgroundColor: '#fff'}}>
          <Text style={{fontSize: 20, fontWeight: 'bold', color: 'red'}}>¡Oops! Hubo un error.</Text>
          <Text style={{marginTop: 10}}>{String(this.state.error)}</Text>
          <TouchableOpacity onPress={() => this.setState({hasError: false})} style={{marginTop: 20, padding: 10, backgroundColor: '#D48A9A', borderRadius: 8}}>
            <Text style={{color: '#fff', textAlign: 'center'}}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
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
  menuSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    backgroundColor: '#fff',
  },
  menuSelectorText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#D48A9A',
    marginRight: 8,
  },
  menuSelectorIcon: {
    fontSize: 12,
    color: '#D48A9A',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  menuDropdown: {
    backgroundColor: '#fff',
    width: '90%',
    maxWidth: 400,
    marginTop: Platform.OS === 'ios' ? 100 : 80, // Positioned below header
    borderRadius: 12,
    padding: 10,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
  },
  menuItem: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuItemActive: {
    backgroundColor: 'rgba(212,138,154,0.1)',
    borderRadius: 8,
    borderBottomWidth: 0,
  },
  menuItemText: {
    fontSize: 16,
    color: '#333',
  },
  menuItemTextActive: {
    color: '#D48A9A',
    fontWeight: 'bold',
  },
});
