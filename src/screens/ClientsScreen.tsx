import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  UIManager
} from 'react-native';
import { collection, onSnapshot, query, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Client {
  id: string;
  name: string;
  phone: string;
  address?: string;
  detailedInfo?: string;
  createdAt?: any;
}

interface Appointment {
  id: string;
  client: string;
  phone?: string;
  date: string;
  time: string;
  serviceName: string;
  duration: string;
  price?: string;
  address?: string;
  detailedInfo?: string;
  team?: string;
  status?: 'pending' | 'completed' | 'cancelled';
  paymentStatus?: 'paid' | 'pending';
  finalPrice?: string;
}

export default function ClientsScreen() {
  const [clients, setClients] = useState<Client[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);

  // 1. Cargar Clientes
  useEffect(() => {
    const qClients = query(collection(db, 'clients'));
    const unsubscribeClients = onSnapshot(qClients, (snapshot) => {
      const list: Client[] = [];
      snapshot.forEach(docSnap => list.push({ id: docSnap.id, ...docSnap.data() } as Client));
      list.sort((a, b) => a.name.localeCompare(b.name));
      setClients(list);
      setLoading(false);
    });
    return () => unsubscribeClients();
  }, []);

  // 2. Cargar Citas
  useEffect(() => {
    const qApps = query(collection(db, 'appointments'));
    const unsubscribeApps = onSnapshot(qApps, (snapshot) => {
      const list: Appointment[] = [];
      snapshot.forEach(docSnap => list.push({ id: docSnap.id, ...docSnap.data() } as Appointment));
      list.sort((a, b) => b.date.localeCompare(a.date));
      setAppointments(list);
    });
    return () => unsubscribeApps();
  }, []);

  const callClient = (phone: string) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`);
  };

  const toggleHistory = (clientId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedClientId(prev => prev === clientId ? null : clientId);
  };

  const deleteClient = async (id: string, name: string) => {
    if (window.confirm(`¿Estás seguro de que deseas eliminar al cliente "${name}"? Esto no eliminará sus citas pasadas.`)) {
      try {
        await deleteDoc(doc(db, 'clients', id));
      } catch (error) {
        alert('Hubo un error al eliminar el cliente.');
      }
    }
  };

  const clientsWithStats = clients.map(client => {
    const clientHistory = appointments.filter(a =>
      (client.phone && a.phone === client.phone) ||
      a.client.toLowerCase() === client.name.toLowerCase()
    );

    const completedCount = clientHistory.filter(a => a.status === 'completed').length;
    const cancelledCount = clientHistory.filter(a => a.status === 'cancelled').length;
    
    const totalSpent = clientHistory.reduce((sum, app) => {
      if (app.status === 'completed' && app.paymentStatus === 'paid') {
        const p = parseFloat(app.finalPrice || app.price || '0');
        return isNaN(p) ? sum : sum + p;
      }
      return sum;
    }, 0);

    return { ...client, clientHistory, completedCount, cancelledCount, totalSpent };
  });

  const filteredClients = clientsWithStats.filter(c => {
    const term = searchTerm.toLowerCase();
    const matchesName = c.name.toLowerCase().includes(term);
    const matchesPhone = c.phone ? c.phone.includes(term) : false;
    return matchesName || matchesPhone;
  }).sort((a, b) => b.completedCount - a.completedCount);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Cartera de Clientes</Text>

      <TextInput
        style={styles.searchInput}
        placeholder="🔍 Buscar por nombre o teléfono..."
        value={searchTerm}
        onChangeText={setSearchTerm}
      />

      {loading ? (
        <ActivityIndicator size="large" color="#D48A9A" style={{ marginTop: 30 }} />
      ) : (
        <FlatList
          data={filteredClients}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 50 }}
          renderItem={({ item }) => {
            const { clientHistory, completedCount, cancelledCount, totalSpent } = item;
            const isProblematic = cancelledCount >= 2;
            const isVIP = completedCount >= 10;
            const isExpanded = expandedClientId === item.id;
            
            // Generate initials
            const initials = item.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase();

            return (
              <TouchableOpacity 
                activeOpacity={0.95}
                style={[
                  styles.clientCard, 
                  isVIP && { borderColor: 'rgba(241, 196, 15, 0.5)', backgroundColor: 'rgba(255, 249, 230, 0.9)' },
                  isProblematic && { borderColor: 'rgba(231, 76, 60, 0.5)', backgroundColor: 'rgba(253, 240, 240, 0.9)' }
                ]}
                onPress={() => toggleHistory(item.id)}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.avatarContainer}>
                    <Text style={styles.avatarText}>{initials}</Text>
                  </View>

                  <View style={styles.clientInfo}>
                    <Text style={styles.clientName}>{item.name}</Text>
                    {item.phone ? (
                      <TouchableOpacity onPress={() => callClient(item.phone)}>
                        <Text style={styles.clientPhone}>📞 {item.phone}</Text>
                      </TouchableOpacity>
                    ) : null}
                    
                    <View style={styles.badgesRow}>
                      <Text style={styles.badgeText}>✅ {completedCount} citas</Text>
                      {cancelledCount > 0 && <Text style={[styles.badgeText, { color: '#e74c3c' }]}>❌ {cancelledCount} canceladas</Text>}
                      <Text style={[styles.badgeText, { color: '#2ecc71', fontWeight: 'bold' }]}>💰 {totalSpent.toFixed(0)}€ totales</Text>
                    </View>
                    
                    {isVIP && <Text style={styles.vipTag}>🏆 Clienta VIP Avalon</Text>}
                    {isProblematic && <Text style={styles.problemTag}>⚠️ ATENCIÓN: Pedir Fianza.</Text>}
                  </View>

                  <TouchableOpacity onPress={() => deleteClient(item.id, item.name)} style={styles.deleteBtn}>
                    <Text style={styles.deleteBtnText}>🗑️</Text>
                  </TouchableOpacity>
                </View>

                {isExpanded && (
                  <View style={styles.historyContainer}>
                    <Text style={styles.historyTitle}>📋 Últimos Servicios:</Text>
                    {clientHistory.length === 0 ? (
                      <Text style={styles.noHistory}>No hay servicios registrados.</Text>
                    ) : (
                      clientHistory.slice(0, 5).map(app => (
                        <View key={app.id} style={styles.historyItem}>
                          <Text style={styles.historyDate}>{app.date} a las {app.time}</Text>
                          <Text style={styles.historyService}>{app.serviceName}</Text>
                          <Text style={[styles.historyStatus, 
                            app.status === 'completed' ? {color: '#2ecc71'} : 
                            app.status === 'cancelled' ? {color: '#e74c3c'} : 
                            {color: '#f39c12'}
                          ]}>
                            {app.status === 'completed' ? `Completado (${app.finalPrice || app.price}€)` : 
                             app.status === 'cancelled' ? 'Cancelado' : 'Pendiente'}
                          </Text>
                        </View>
                      ))
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {searchTerm ? 'No se encontraron clientes.' : 'Aún no hay clientes registrados.'}
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f4f7', padding: 15 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#333', marginBottom: 15 },
  searchInput: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: '#e1e8ed',
    borderRadius: 20,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 }
  },
  
  clientCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 16,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,1)',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
  },
  
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },

  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#ffeaf0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
    borderWidth: 1,
    borderColor: '#ffcce0',
    shadowColor: '#D48A9A',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  avatarText: { fontSize: 18, fontWeight: 'bold', color: '#D48A9A' },
  
  clientInfo: { flex: 1, justifyContent: 'center' },
  clientName: { fontSize: 18, fontWeight: 'bold', color: '#2c3e50' },
  clientPhone: { fontSize: 14, color: '#3498db', marginTop: 2, fontWeight: '500' },
  
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 },
  badgeText: { fontSize: 12, color: '#7f8c8d' },
  
  vipTag: { color: '#f39c12', fontWeight: 'bold', fontSize: 13, marginTop: 5 },
  problemTag: { color: '#c0392b', fontWeight: 'bold', fontSize: 12, marginTop: 5 },
  
  deleteBtn: { padding: 8, backgroundColor: 'rgba(255,0,0,0.05)', borderRadius: 20, marginLeft: 10 },
  deleteBtnText: { fontSize: 16 },
  
  historyContainer: { marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
  historyTitle: { fontSize: 14, fontWeight: 'bold', color: '#444', marginBottom: 10 },
  historyItem: { backgroundColor: 'rgba(0,0,0,0.02)', padding: 10, borderRadius: 10, marginBottom: 8 },
  historyDate: { fontSize: 12, color: '#666', fontWeight: 'bold' },
  historyService: { fontSize: 14, color: '#333', marginTop: 2 },
  historyStatus: { fontSize: 12, marginTop: 4, fontWeight: 'bold' },
  noHistory: { fontSize: 13, color: '#888', fontStyle: 'italic' },
  empty: { textAlign: 'center', color: '#888', marginTop: 30, fontStyle: 'italic', fontSize: 15 }
});
