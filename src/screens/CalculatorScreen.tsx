import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../config/firebase';

const getStartOfWeek = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay() || 7; 
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day + 1);
  return d;
};
const formatYMD = (d: Date) => d.toISOString().split('T')[0];

export default function CalculatorScreen() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [weekOffset, setWeekOffset] = useState(0);
  const [percentages, setPercentages] = useState<Record<string, string>>({});

  useEffect(() => {
    const qApps = query(collection(db, 'appointments'));
    const unsubApps = onSnapshot(qApps, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach(docSnap => list.push({ id: docSnap.id, ...docSnap.data() }));
      setAppointments(list);
      setLoading(false);
    });
    return () => unsubApps();
  }, []);

  const stats = useMemo(() => {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + (weekOffset * 7));
    
    const startStr = formatYMD(getStartOfWeek(targetDate));
    const end = new Date(getStartOfWeek(targetDate)); 
    end.setDate(end.getDate() + 6);
    const endStr = formatYMD(end);

    const byTeam: Record<string, { revenue: number, completedCount: number }> = {};

    appointments.forEach(app => {
      if (!app.date || app.date < startStr || app.date > endStr) return;
      if (app.status === 'completed' && app.paymentStatus === 'paid' && app.finalPrice) {
        const team = app.team || 'Sin asignar';
        if (!byTeam[team]) byTeam[team] = { revenue: 0, completedCount: 0 };
        
        const price = parseFloat(app.finalPrice) || 0;
        byTeam[team].revenue += price;
        byTeam[team].completedCount += 1;
      }
    });

    return { startStr, endStr, byTeam };
  }, [appointments, weekOffset]);

  const handlePercentageChange = (team: string, val: string) => {
    setPercentages(prev => ({ ...prev, [team]: val }));
  };

  if (loading) return <ActivityIndicator size="large" color="#D48A9A" style={{marginTop: 50}} />;

  const teams = Object.keys(stats.byTeam).sort();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.mainTitle}>🧮 Calculadora de Nóminas</Text>
        <Text style={styles.subtitle}>Calcula la comisión semanal de las empleadas.</Text>
      </View>

      <View style={styles.weekControl}>
        <TouchableOpacity style={styles.weekBtn} onPress={() => setWeekOffset(w => w - 1)}>
          <Text style={styles.weekBtnText}>◀ Anterior</Text>
        </TouchableOpacity>
        <View style={styles.weekInfo}>
          <Text style={styles.weekDatesText}>Semana del</Text>
          <Text style={styles.weekDates}>{stats.startStr}</Text>
        </View>
        <TouchableOpacity style={styles.weekBtn} onPress={() => setWeekOffset(w => w + 1)}>
          <Text style={styles.weekBtnText}>Siguiente ▶</Text>
        </TouchableOpacity>
      </View>

      {teams.length > 0 ? (
        teams.map(team => {
          const revenue = stats.byTeam[team].revenue;
          const completedCount = stats.byTeam[team].completedCount;
          const pctVal = parseFloat(percentages[team] || '0') || 0;
          const payout = (revenue * (pctVal / 100)).toFixed(2);

          return (
            <View key={team} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.teamName}>💇‍♀️ {team}</Text>
                <Text style={styles.serviceCount}>{completedCount} servicios cobrados</Text>
              </View>
              
              <View style={styles.calcRow}>
                <View style={styles.calcCol}>
                  <Text style={styles.label}>Caja semanal:</Text>
                  <Text style={styles.revenueText}>{revenue.toFixed(2)} €</Text>
                </View>

                <View style={styles.calcColCenter}>
                  <Text style={styles.label}>Comisión %:</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    placeholder="Ej: 50"
                    value={percentages[team] || ''}
                    onChangeText={(val) => handlePercentageChange(team, val)}
                  />
                </View>

                <View style={styles.calcColRight}>
                  <Text style={styles.label}>A Pagar:</Text>
                  <Text style={styles.payoutText}>{payout} €</Text>
                </View>
              </View>
            </View>
          );
        })
      ) : (
        <View style={styles.card}>
          <Text style={styles.noDataText}>No hay servicios cobrados en esta semana.</Text>
        </View>
      )}
      
      <View style={{height: 40}} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f4f7', padding: 15 },
  header: { marginBottom: 20 },
  mainTitle: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  subtitle: { fontSize: 14, color: '#666', marginTop: 4 },
  
  weekControl: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 10, borderRadius: 12, marginBottom: 20, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: {width: 0, height: 2} },
  weekBtn: { padding: 10, backgroundColor: '#f5f7fa', borderRadius: 8 },
  weekBtnText: { color: '#333', fontWeight: 'bold', fontSize: 13 },
  weekInfo: { alignItems: 'center' },
  weekDates: { fontWeight: 'bold', color: '#D48A9A', fontSize: 15 },
  weekDatesText: { fontSize: 11, color: '#999' },

  card: { backgroundColor: '#fff', borderRadius: 14, padding: 18, marginBottom: 15, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: {width: 0, height: 2} },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f0f0f0', paddingBottom: 10, marginBottom: 15 },
  teamName: { fontSize: 18, fontWeight: 'bold', color: '#444' },
  serviceCount: { fontSize: 13, color: '#888' },

  calcRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  calcCol: { flex: 1, alignItems: 'flex-start' },
  calcColCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 10 },
  calcColRight: { flex: 1, alignItems: 'flex-end' },
  
  label: { fontSize: 12, color: '#666', marginBottom: 6, fontWeight: 'bold' },
  revenueText: { fontSize: 18, fontWeight: 'bold', color: '#2ecc71' },
  
  input: { backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#eee', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 8, width: 80, textAlign: 'center', fontSize: 16, fontWeight: 'bold', color: '#D48A9A' },
  
  payoutText: { fontSize: 22, fontWeight: 'bold', color: '#D48A9A' },

  noDataText: { color: '#888', fontStyle: 'italic', textAlign: 'center', marginVertical: 10 },
});
