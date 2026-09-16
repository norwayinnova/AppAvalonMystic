import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TextInput, TouchableOpacity } from 'react-native';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../config/firebase';

// Helper to get start and end dates
const getStartOfWeek = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay() || 7; 
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day + 1);
  return d;
};
const getStartOfMonth = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(1);
  return d;
};

export default function DashboardScreen() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminConfig, setAdminConfig] = useState({ pin: '1234', pinEnabled: true });
  const [newPin, setNewPin] = useState('');
  const [newTeamName, setNewTeamName] = useState('');

  useEffect(() => {
    const qApps = query(collection(db, 'appointments'));
    const unsub = onSnapshot(qApps, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach(docSnap => list.push({ id: docSnap.id, ...docSnap.data() }));
      setAppointments(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const qTeams = query(collection(db, 'teams'));
    const unsub = onSnapshot(qTeams, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach(docSnap => list.push({ id: docSnap.id, ...docSnap.data() }));
      setTeams(list);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const { doc } = require('firebase/firestore');
    const unsub = onSnapshot(doc(db, 'config', 'admin'), (docSnap: any) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setAdminConfig({ pinEnabled: data.pinEnabled, pin: data.pin });
      }
    });
    return () => unsub();
  }, []);

  const handleUpdatePin = async () => {
    if (newPin.length !== 4) return alert('El PIN debe tener 4 números.');
    try {
      const { doc, setDoc } = require('firebase/firestore');
      await setDoc(doc(db, 'config', 'admin'), { pin: newPin, pinEnabled: true }, { merge: true });
      alert('PIN actualizado con éxito.');
      setNewPin('');
    } catch (e) {
      alert('Error al guardar el PIN.');
    }
  };

  const handleAddTeam = async () => {
    if (!newTeamName.trim()) return;
    try {
      const { addDoc } = require('firebase/firestore');
      await addDoc(collection(db, 'teams'), { name: newTeamName.trim(), members: '' });
      setNewTeamName('');
    } catch (e) {
      alert('Error al añadir empleada.');
    }
  };

  const handleDeleteTeam = async (id: string) => {
    try {
      const { doc, deleteDoc } = require('firebase/firestore');
      await deleteDoc(doc(db, 'teams', id));
    } catch (e) {
      alert('Error al eliminar.');
    }
  };

  const stats = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    const startOfWeekStr = getStartOfWeek(now).toISOString().split('T')[0];
    const startOfMonthStr = getStartOfMonth(now).toISOString().split('T')[0];
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    const endOfWeek = new Date(getStartOfWeek(now));
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    const endOfWeekStr = endOfWeek.toISOString().split('T')[0];

    // Data structures
    const data = {
      day: { clients: 0, revenue: 0, byTeam: {} as Record<string, { clients: number, revenue: number }> },
      week: { clients: 0, revenue: 0, byTeam: {} as Record<string, { clients: number, revenue: number }> },
      month: { clients: 0, revenue: 0, byTeam: {} as Record<string, { clients: number, revenue: number }> }
    };

    appointments.forEach(app => {
      if (!app.date) return;
      const team = app.team || 'Sin asignar';
      const price = parseFloat(app.price) || 0;

      // Initialize team objects if not present
      ['day', 'week', 'month'].forEach(period => {
        if (!data[period as keyof typeof data].byTeam[team]) {
          data[period as keyof typeof data].byTeam[team] = { clients: 0, revenue: 0 };
        }
      });

      // Check Day
      if (app.date === todayStr) {
        data.day.clients += 1;
        data.day.revenue += price;
        data.day.byTeam[team].clients += 1;
        data.day.byTeam[team].revenue += price;
      }

      // Check Week
      if (app.date >= startOfWeekStr && app.date <= endOfWeekStr) {
        data.week.clients += 1;
        data.week.revenue += price;
        data.week.byTeam[team].clients += 1;
        data.week.byTeam[team].revenue += price;
      }

      // Check Month
      if (app.date >= startOfMonthStr && app.date <= endOfMonth) {
        data.month.clients += 1;
        data.month.revenue += price;
        data.month.byTeam[team].clients += 1;
        data.month.byTeam[team].revenue += price;
      }
    });

    return data;
  }, [appointments]);

  if (loading) {
    return <ActivityIndicator size="large" color="#E91E63" style={{ flex: 1, justifyContent: 'center' }} />;
  }

  const renderStatCard = (title: string, periodData: any) => {
    // Filter teams that actually have data for this period to avoid showing 0s
    const activeTeams = Object.keys(periodData.byTeam).filter(
      team => periodData.byTeam[team].clients > 0 || periodData.byTeam[team].revenue > 0
    );

    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{title}</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Total Clientes</Text>
            <Text style={styles.summaryValue}>{periodData.clients}</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Facturación</Text>
            <Text style={styles.summaryValue}>{periodData.revenue.toFixed(2)} €</Text>
          </View>
        </View>
        
        <Text style={styles.subtitle}>Desglose por Empleada/Equipo:</Text>
        {activeTeams.map(team => {
          const tData = periodData.byTeam[team];
          return (
            <View key={team} style={styles.teamRow}>
              <Text style={styles.teamName}>{team}</Text>
              <Text style={styles.teamStats}>{tData.clients} citas | {tData.revenue.toFixed(2)} €</Text>
            </View>
          );
        })}
        {activeTeams.length === 0 && (
          <Text style={styles.noDataText}>No hay actividad en este periodo.</Text>
        )}
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.mainTitle}>📊 Dashboard Ejecutivo Avalon Mystic</Text>
      {renderStatCard('Hoy', stats.day)}
      {renderStatCard('Esta Semana', stats.week)}
      {renderStatCard('Este Mes', stats.month)}

      {/* TARJETA DE ADMINISTRACIÓN */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>⚙️ Configuración y Empleadas</Text>
        
        {/* Cambiar PIN */}
        <Text style={styles.subtitle}>Cambiar PIN de Administrador (Actual: {adminConfig.pin || '1234'})</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Nuevo PIN (4 dígitos)"
            keyboardType="numeric"
            maxLength={4}
            value={newPin}
            onChangeText={setNewPin}
          />
          <TouchableOpacity style={styles.btnAction} onPress={handleUpdatePin}>
            <Text style={styles.btnText}>Guardar PIN</Text>
          </TouchableOpacity>
        </View>

        {/* Añadir Empleada */}
        <Text style={[styles.subtitle, {marginTop: 15}]}>Añadir Perfil de Empleada</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Nombre (ej. María)"
            value={newTeamName}
            onChangeText={setNewTeamName}
          />
          <TouchableOpacity style={styles.btnAction} onPress={handleAddTeam}>
            <Text style={styles.btnText}>+ Añadir</Text>
          </TouchableOpacity>
        </View>

        {/* Lista de Empleadas */}
        {teams.length > 0 && (
          <View style={{marginTop: 15}}>
            <Text style={styles.subtitle}>Perfiles de Acceso Actuales:</Text>
            {teams.map(t => (
              <View key={t.id} style={styles.teamRow}>
                <Text style={styles.teamName}>💇‍♀️ {t.name}</Text>
                <TouchableOpacity onPress={() => handleDeleteTeam(t.id)} style={styles.delBtn}>
                  <Text style={styles.delBtnText}>🗑️ Eliminar</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={{height: 40}} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 15, backgroundColor: '#f9f9f9' },
  mainTitle: { fontSize: 22, fontWeight: 'bold', color: '#E91E63', marginBottom: 20, textAlign: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 15, marginBottom: 15, elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowOffset: {width: 0, height: 2} },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  summaryBox: { alignItems: 'center', flex: 1 },
  summaryLabel: { fontSize: 14, color: '#666', marginBottom: 5 },
  summaryValue: { fontSize: 24, fontWeight: 'bold', color: '#E91E63' },
  subtitle: { fontSize: 14, fontWeight: '600', color: '#444', marginBottom: 10 },
  teamRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  teamName: { fontSize: 14, color: '#333', fontWeight: '500' },
  teamStats: { fontSize: 14, color: '#666' },
  noDataText: { fontSize: 14, color: '#999', fontStyle: 'italic', textAlign: 'center', marginTop: 10 },
  inputRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  input: { flex: 1, backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#ddd', padding: 10, borderRadius: 6 },
  btnAction: { backgroundColor: '#E91E63', paddingVertical: 12, paddingHorizontal: 15, borderRadius: 6 },
  btnText: { color: '#fff', fontWeight: 'bold' },
  delBtn: { padding: 8, backgroundColor: '#ffebee', borderRadius: 4 },
  delBtnText: { color: '#d32f2f', fontSize: 12, fontWeight: 'bold' }
});
