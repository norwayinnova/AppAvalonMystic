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

  const [expenses, setExpenses] = useState<any[]>([]);

  useEffect(() => {
    const qApps = query(collection(db, 'appointments'));
    const unsubApps = onSnapshot(qApps, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach(docSnap => list.push({ id: docSnap.id, ...docSnap.data() }));
      setAppointments(list);
      setLoading(false);
    });
    
    const qExp = query(collection(db, 'expenses'));
    const unsubExp = onSnapshot(qExp, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach(docSnap => list.push({ id: docSnap.id, ...docSnap.data() }));
      setExpenses(list);
    });

    return () => { unsubApps(); unsubExp(); };
  }, []);

  const handlePay = async (team: string, weekStart: string, amount: string, paymentRef: string, description: string) => {
    if (!amount || amount === '0.00' || amount === '0') return alert('El importe no puede ser cero.');
    if (!window.confirm(`¿Confirmas el pago de ${amount}€ a ${team} (${description})?`)) return;

    try {
      const { addDoc } = require('firebase/firestore');
      await addDoc(collection(db, 'expenses'), {
        amount,
        category: 'Nómina',
        description: `Nómina ${team} - ${description}`,
        date: new Date().toISOString().split('T')[0],
        type: 'payroll',
        team,
        week: weekStart,
        paymentRef, // 'bizum' or 'cash_2024-05-12'
        createdAt: new Date()
      });
      alert('Pago registrado con éxito.');
    } catch (error) {
      alert('Error al registrar el pago.');
    }
  };

  const stats = useMemo(() => {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + (weekOffset * 7));
    
    const startStr = formatYMD(getStartOfWeek(targetDate));
    const end = new Date(getStartOfWeek(targetDate)); 
    end.setDate(end.getDate() + 6);
    const endStr = formatYMD(end);

    const byTeam: Record<string, { bizum: number, dailyCash: Record<string, number>, completedCount: number }> = {};

    appointments.forEach(app => {
      if (!app.date || app.date < startStr || app.date > endStr) return;
      if (app.status === 'completed' && app.paymentStatus === 'paid' && app.finalPrice) {
        const team = app.team || 'Sin asignar';
        if (!byTeam[team]) byTeam[team] = { bizum: 0, dailyCash: {}, completedCount: 0 };
        
        const price = parseFloat(app.finalPrice) || 0;
        byTeam[team].completedCount += 1;
        
        if (app.paymentMethod === 'bizum') {
          byTeam[team].bizum += price;
        } else if (app.paymentMethod === 'cash') {
          if (!byTeam[team].dailyCash[app.date]) byTeam[team].dailyCash[app.date] = 0;
          byTeam[team].dailyCash[app.date] += price;
        }
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
          const data = stats.byTeam[team];
          const bizum = data.bizum || 0;
          const dailyCash = data.dailyCash || {};
          const cashDays = Object.keys(dailyCash).sort();
          
          const completedCount = data.completedCount;
          const pctVal = parseFloat(percentages[team] || '0') || 0;
          
          const bizumPayout = (bizum * (pctVal / 100)).toFixed(2);
          const isBizumPaid = expenses.find(ex => ex.type === 'payroll' && ex.team === team && ex.week === stats.startStr && ex.paymentRef === 'bizum');

          return (
            <View key={team} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.teamName}>💇‍♀️ {team}</Text>
                <Text style={styles.serviceCount}>{completedCount} servicios cobrados</Text>
              </View>
              
              <View style={{ alignItems: 'center', marginBottom: 15 }}>
                <Text style={styles.label}>Comisión a aplicar (%):</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  placeholder="Ej: 50"
                  value={percentages[team] || ''}
                  onChangeText={(val) => handlePercentageChange(team, val)}
                />
              </View>

              {/* BIZUM SEMANAL */}
              <View style={[styles.calcRow, { borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 10, marginBottom: 10 }]}>
                <View style={styles.calcCol}>
                  <Text style={styles.label}>Bizum (Semana):</Text>
                  <Text style={styles.revenueText}>📱 {bizum.toFixed(2)} €</Text>
                </View>

                <View style={styles.calcColRight}>
                  <Text style={styles.label}>A Pagar (Bizum):</Text>
                  {isBizumPaid ? (
                    <View style={{alignItems: 'center'}}>
                      <Text style={[styles.payoutText, {color: '#888'}]}>{isBizumPaid.amount} €</Text>
                      <View style={styles.paidBadge}><Text style={styles.paidBadgeText}>✓ Pagado</Text></View>
                    </View>
                  ) : (
                    <View style={{alignItems: 'center'}}>
                      <Text style={styles.payoutText}>{bizumPayout} €</Text>
                      <TouchableOpacity style={styles.payBtn} onPress={() => handlePay(team, stats.startStr, bizumPayout, 'bizum', `Bizum Semanal`)}>
                        <Text style={styles.payBtnText}>Marcar Pagado</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>

              {/* EFECTIVO DIARIO */}
              <Text style={[styles.label, { marginTop: 5, marginBottom: 10 }]}>Efectivo (Diario):</Text>
              {cashDays.length === 0 ? (
                <Text style={styles.noDataText}>No hubo cobros en efectivo.</Text>
              ) : (
                cashDays.map(dayStr => {
                  const cashVal = dailyCash[dayStr] || 0;
                  const cashPayout = (cashVal * (pctVal / 100)).toFixed(2);
                  const isCashPaid = expenses.find(ex => ex.type === 'payroll' && ex.team === team && ex.week === stats.startStr && ex.paymentRef === `cash_${dayStr}`);

                  return (
                    <View key={dayStr} style={[styles.calcRow, { marginBottom: 15 }]}>
                      <View style={styles.calcCol}>
                        <Text style={[styles.label, {color: '#555'}]}>Día {dayStr.split('-').reverse().join('/')}:</Text>
                        <Text style={[styles.revenueText, {fontSize: 15, color: '#4a9b40'}]}>💵 {cashVal.toFixed(2)} €</Text>
                      </View>

                      <View style={styles.calcColRight}>
                        <Text style={styles.label}>A Pagar:</Text>
                        {isCashPaid ? (
                          <View style={{alignItems: 'center'}}>
                            <Text style={[styles.payoutText, {color: '#888', fontSize: 16}]}>{isCashPaid.amount} €</Text>
                            <View style={styles.paidBadge}><Text style={styles.paidBadgeText}>✓ Pagado</Text></View>
                          </View>
                        ) : (
                          <View style={{alignItems: 'center'}}>
                            <Text style={[styles.payoutText, {fontSize: 16}]}>{cashPayout} €</Text>
                            <TouchableOpacity style={[styles.payBtn, {backgroundColor: '#4a9b40', paddingVertical: 6, paddingHorizontal: 10}]} onPress={() => handlePay(team, stats.startStr, cashPayout, `cash_${dayStr}`, `Efectivo día ${dayStr}`)}>
                              <Text style={[styles.payBtnText, {fontSize: 11}]}>Marcar Pagado</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })
              )}
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
  
  payBtn: { backgroundColor: '#2ecc71', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, marginTop: 8 },
  payBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  
  paidBadge: { backgroundColor: '#f0f0f0', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, marginTop: 8 },
  paidBadgeText: { color: '#888', fontWeight: 'bold', fontSize: 12 },

  noDataText: { color: '#888', fontStyle: 'italic', textAlign: 'center', marginVertical: 10 },
});
