import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
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
  const [loading, setLoading] = useState(true);

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
  noDataText: { fontSize: 14, color: '#999', fontStyle: 'italic', textAlign: 'center', marginTop: 10 }
});
