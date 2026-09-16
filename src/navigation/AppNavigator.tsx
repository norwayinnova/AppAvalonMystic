import React from 'react';
import { Image, View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import RoleSelectionScreen from '../screens/RoleSelectionScreen';
import { useAppContext } from '../context/AppContext';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import CalendarScreen from '../screens/CalendarScreen';
import AppointmentsScreen from '../screens/AppointmentsScreen';
import ServicesScreen from '../screens/ServicesScreen';
import RouteScreen from '../screens/RouteScreen';
import ClientsScreen from '../screens/ClientsScreen';
import DashboardScreen from '../screens/DashboardScreen';
import ExpensesScreen from '../screens/ExpensesScreen';
import InventoryScreen from '../screens/InventoryScreen';

const Tab = createMaterialTopTabNavigator();
const Stack = createNativeStackNavigator();

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

// Barra de pestañas adaptable a Móvil y Ordenador (con deslizamiento táctil horizontal)
function CustomTopTabBar({ state, descriptors, navigation }: any) {
  return (
    <View style={styles.tabBarWrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabScrollContent}
      >
        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          const label =
            options.tabBarLabel !== undefined
              ? options.tabBarLabel
              : options.title !== undefined
              ? options.title
              : route.name;

          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
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
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ... (keep CustomTopTabBar and styles intact)

function TopTabs() {
  const { role, teamName } = useAppContext();
  const isAdmin = role === 'admin';
  const isManagement = role === 'management';
  const showAdminOnly = isAdmin; // Solo admin ve Dashboard

  return (
    <Tab.Navigator tabBar={(props) => <CustomTopTabBar {...props} />}>
      {showAdminOnly && <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ tabBarLabel: '📊 Dashboard' }} />}
      
      <Tab.Screen name="Calendar" component={CalendarScreen} options={{ tabBarLabel: '📅 Calendario' }} initialParams={{ role, teamName }} />
      <Tab.Screen name="Route" component={RouteScreen} options={{ tabBarLabel: '🗺️ Rutas' }} initialParams={{ role, teamName }} />
      <Tab.Screen name="Appointments" component={AppointmentsScreen} options={{ tabBarLabel: '➕ Nueva Cita' }} initialParams={{ role, teamName }} />
      
      {(isAdmin || isManagement) && <Tab.Screen name="Clients" component={ClientsScreen} options={{ tabBarLabel: '👥 Clientes' }} />}
      {(isAdmin || isManagement) && <Tab.Screen name="Services" component={ServicesScreen} options={{ tabBarLabel: '🧹 Servicios' }} />}
      {(isAdmin || isManagement) && <Tab.Screen name="Expenses" component={ExpensesScreen} options={{ tabBarLabel: '💸 Gastos' }} />}
      
      <Tab.Screen name="Inventory" component={InventoryScreen} options={{ tabBarLabel: '📦 Inventario' }} initialParams={{ role, teamName }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { role, logout } = useAppContext();

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#FFFFFF' },
          headerTitleAlign: 'center',
          headerTitle: () => (
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <LogoTitle />
            </View>
          ),
          headerRight: () => role ? (
            <TouchableOpacity onPress={logout} style={{marginRight: 15, padding: 6, backgroundColor: 'rgba(233,30,99,0.1)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(233,30,99,0.3)'}}>
              <Text style={{color: '#E91E63', fontWeight: 'bold', fontSize: 13}}>Salir 🔒</Text>
            </TouchableOpacity>
          ) : null
        }}
      >
        {!role ? (
          <Stack.Screen name="Login" component={RoleSelectionScreen} options={{ headerShown: false }} />
        ) : (
          <Stack.Screen name="Main" component={TopTabs} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
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
    minWidth: '100%',
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
  tabButtonActive: {
    borderBottomColor: '#E91E63', // Pink accent
  },
  tabButtonInactive: {
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontWeight: 'bold',
    fontSize: 13,
    textAlign: 'center'
  },
  tabTextActive: {
    color: '#E91E63',
    fontWeight: 'bold',
  },
  tabTextInactive: {
    color: '#888888',
    fontWeight: '600',
  }
});

