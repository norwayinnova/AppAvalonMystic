import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Linking,
  ActivityIndicator
} from 'react-native';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase';

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
}

export default function ClientsScreen({ navigation }: any) {
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

  // 2. Cargar todas las Citas para el Historial
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

  // Filtrar clientes por nombre o teléfono
  const filteredClients = clients.filter(c => {
    const term = searchTerm.toLowerCase();
    const matchesName = c.name.toLowerCase().includes(term);
    const matchesPhone = c.phone ? c.phone.includes(term) : false;
    return matchesName || matchesPhone;
  });

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
          renderItem={({ item }) => {
            // Obtener el historial de servicios de este cliente (por teléfono o nombre)
            const clientHistory = appointments.filter(a =>
              (item.phone && a.phone === item.phone) ||
              a.client.toLowerCase() === item.name.toLowerCase()
            );

            // Calcular importe total acumulado
            const totalSpent = clientHistory.reduce((sum, app) => {
              const p = parseFloat(app.price || '0');
              return isNaN(p) ? sum : sum + p;
            }, 0);
            
            const cancelledCount = clientHistory.filter(a => a.status === 'cancelled').length;
            const isProblematic = cancelledCount >= 2;

            const isExpanded = expandedClientId === item.id;

            return (
              <View style={styles.clientCard}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between' }}>
                    <View>
                      <Text style={styles.clientName}>👤 {item.name}</Text>
                      {isProblematic && (
                        <Text style={{color: '#c0392b', fontWeight: 'bold', fontSize: 12, marginTop: 2}}>
                          ⚠️ Clienta Problemática ({cancelledCount} cancelaciones)
                        </Text>
                      )}
                      {item.phone ? (
                        <TouchableOpacity style={styles.phoneRow} onPress={() => callClient(item.phone)}>
                          <Text style={styles.phoneText}>📞 {item.phone}</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                    <TouchableOpacity onPress={() => deleteClient(item.id, item.name)} style={styles.deleteBtn}>
                      <Text style={styles.deleteBtnText}>🗑️</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.badgeColumn}>
                    <View style={styles.countBadge}>
                      <Text style={styles.countBadgeText}>{clientHistory.length} servicios</Text>
                    </View>
                    {totalSpent > 0 ? (
                      <Text style={styles.totalSpentText}>💶 {totalSpent} € total</Text>
                    ) : null}
                  </View>
                </View>

                {item.address ? (
                  <Text style={styles.addressText}>📍 {item.address}</Text>
                ) : null}
                {item.detailedInfo ? (
                  <Text style={styles.detailedText}>🏢 {item.detailedInfo}</Text>
                ) : null}

                {/* BOTÓN PARA DESPLEGAR EL HISTORIAL */}
                <TouchableOpacity
                  style={styles.historyToggleBtn}
                  onPress={() => toggleHistory(item.id)}
                >
                  <Text style={styles.historyToggleText}>
                    {isExpanded ? 'Ocultar Historial ▲' : `Ver Historial (${clientHistory.length} citas) ▼`}
                  </Text>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.historyContainer}>
                    <Text style={styles.historyTitle}>📋 Historial de Servicios Contratados:</Text>
                    {clientHistory.length > 0 ? (
                      clientHistory.map((hist) => (
                        <View key={hist.id} style={styles.historyItem}>
                          <View style={styles.historyItemRow}>
                            <Text style={styles.historyDate}>📅 {hist.date} ({hist.time})</Text>
                            {hist.price ? <Text style={styles.historyPrice}>💶 {hist.price} €</Text> : null}
                          </View>
                          <Text style={styles.historyService}>✨ {hist.serviceName} · {hist.team || 'Equipo 1'}</Text>
                          {hist.address ? <Text style={styles.historyAddress}>📍 {hist.address}</Text> : null}
                        </View>
                      ))
                    ) : (
                      <Text style={styles.noHistory}>No hay citas registradas aún.</Text>
                    )}
                  </View>
                )}
              </View>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {searchTerm ? 'No se encontraron clientes.' : 'Aún no hay clientes registrados. Se crearán automáticamente al programar citas.'}
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#FDF9fa' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 15, color: '#7A4B56' },
  searchInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
    fontSize: 15
  },
  clientCard: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EADDE0',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 }
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  clientName: { fontSize: 17, fontWeight: 'bold', color: '#7A4B56' },
  phoneRow: { marginTop: 4, alignSelf: 'flex-start' },
  phoneText: { color: '#7A4B56', fontWeight: 'bold', fontSize: 14, backgroundColor: '#FFF5F7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  badgeColumn: { alignItems: 'flex-end', gap: 4 },
  countBadge: { backgroundColor: '#7A4B56', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  countBadgeText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  totalSpentText: { color: '#D48A9A', fontWeight: 'bold', fontSize: 13 },
  addressText: { color: '#444', fontSize: 14, marginTop: 4 },
  detailedText: { color: '#8a5800', fontSize: 12, fontWeight: 'bold', marginTop: 2 },
  
  historyToggleBtn: {
    backgroundColor: '#FDF9fa',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#d0e0f0'
  },
  historyToggleText: { color: '#7A4B56', fontWeight: 'bold', fontSize: 13 },
  
  historyContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee'
  },
  historyTitle: { fontSize: 13, fontWeight: 'bold', color: '#7A4B56', marginBottom: 8 },
  historyItem: {
    backgroundColor: '#fafbfc',
    padding: 10,
    borderRadius: 6,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#D48A9A',
    borderWidth: 1,
    borderColor: '#eee'
  },
  historyItemRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  historyDate: { fontWeight: 'bold', color: '#333', fontSize: 13 },
  historyPrice: { fontWeight: 'bold', color: '#D48A9A', fontSize: 13 },
  historyService: { color: '#7A4B56', fontSize: 12, fontWeight: 'bold' },
  historyAddress: { color: '#777', fontSize: 11, marginTop: 2 },
  noHistory: { color: '#888', fontStyle: 'italic', fontSize: 12 },
  empty: { textAlign: 'center', color: '#888', marginTop: 30, fontStyle: 'italic', fontSize: 15 },
  deleteBtn: { padding: 8, backgroundColor: '#ffe5e5', borderRadius: 6, alignSelf: 'flex-start', marginLeft: 10 },
  deleteBtnText: { fontSize: 16 }
});
