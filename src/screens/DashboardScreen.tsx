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

const getStartOfYear = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setMonth(0, 1);
  return d;
};

export default function DashboardScreen() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminConfig, setAdminConfig] = useState({ pin: '1234', pinEnabled: true });
  const [newPin, setNewPin] = useState('');
  const [newTeamName, setNewTeamName] = useState('');

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
      await addDoc(collection(db, 'teams'), { name: newTeamName.trim(), members: '', pin: '1234' });
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

  const handleMarkAsPaid = async (id: string, method: 'cash' | 'bizum' | 'otro') => {
    try {
      const { doc, updateDoc } = require('firebase/firestore');
      await updateDoc(doc(db, 'appointments', id), { 
        paymentStatus: 'paid',
        paymentMethod: method
      });
      alert('¡Pago registrado con éxito!');
    } catch (e) {
      alert('Error al actualizar el pago.');
    }
  };

  const handleFreeUpSpace = async () => {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const thresholdDate = threeMonthsAgo.toISOString().split('T')[0];

    if (!window.confirm(`¿Estás seguro de que quieres eliminar todas las citas anteriores al ${thresholdDate}?`)) return;

    try {
        const { getDocs, query, where, writeBatch, doc, getDoc, setDoc } = require('firebase/firestore');
        const q = query(collection(db, 'appointments'), where('date', '<', thresholdDate));
        const snap = await getDocs(q);
        
        if (snap.empty) {
            alert('No hay citas tan antiguas para eliminar.');
            return;
        }

        let totalRevenueArchived = 0;
        let count = 0;

        const batch = writeBatch(db);
        snap.forEach((d: any) => {
            const data = d.data();
            if (data.status === 'completed' && data.paymentStatus === 'paid') {
                totalRevenueArchived += parseFloat(data.finalPrice) || 0;
            }
            batch.delete(d.ref);
            count++;
        });

        if (totalRevenueArchived > 0) {
            const historyRef = doc(db, 'config', 'historical_revenue');
            const historyDoc = await getDoc(historyRef);
            const currentTotal = historyDoc.exists() ? (historyDoc.data().total || 0) : 0;
            await setDoc(historyRef, {
                total: currentTotal + totalRevenueArchived,
                lastCleanup: new Date().toISOString()
            }, { merge: true });
        }

        await batch.commit();
        alert(`¡Espacio liberado! Se han borrado ${count} citas antiguas.\nSe ha archivado una facturación de ${totalRevenueArchived.toFixed(2)} € para el registro histórico.`);
    } catch(e) {
        alert('Error al liberar espacio.');
        console.error(e);
    }
  };

  const stats = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    const startOfWeekStr = getStartOfWeek(now).toISOString().split('T')[0];
    const startOfMonthStr = getStartOfMonth(now).toISOString().split('T')[0];
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    const startOfYearStr = getStartOfYear(now).toISOString().split('T')[0];
    const endOfYearStr = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0];

    const endOfWeek = new Date(getStartOfWeek(now));
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    const endOfWeekStr = endOfWeek.toISOString().split('T')[0];

    // Data structures
    const data = {
      day: { clients: 0, revenue: 0, expenses: 0, cash: 0, bizum: 0, otro: 0, byTeam: {} as Record<string, { clients: number, revenue: number }> },
      week: { clients: 0, revenue: 0, expenses: 0, cash: 0, bizum: 0, otro: 0, byTeam: {} as Record<string, { clients: number, revenue: number }> },
      month: { clients: 0, revenue: 0, expenses: 0, cash: 0, bizum: 0, otro: 0, byTeam: {} as Record<string, { clients: number, revenue: number }> },
      year: { clients: 0, revenue: 0, expenses: 0, cash: 0, bizum: 0, otro: 0, byTeam: {} as Record<string, { clients: number, revenue: number }> }
    };

    const pendingPayments: any[] = [];
    const cancelledAppointments: any[] = [];

    appointments.forEach(app => {
      if (!app.date) return;
      
      if (app.status === 'cancelled') {
        cancelledAppointments.push(app);
        return; 
      }

      const team = app.team || 'Sin asignar';
      let price = 0;
      let method = '';
      if (app.status === 'completed' && app.paymentStatus === 'paid' && app.finalPrice) {
        price = parseFloat(app.finalPrice) || 0;
        method = app.paymentMethod || 'otro';
      }

      if (app.paymentStatus === 'pending') {
        pendingPayments.push(app);
      }

      ['day', 'week', 'month', 'year'].forEach(period => {
        if (!data[period as keyof typeof data].byTeam[team]) {
          data[period as keyof typeof data].byTeam[team] = { clients: 0, revenue: 0 };
        }
      });

      if (app.date === todayStr) {
        data.day.clients += 1;
        data.day.revenue += price;
        if (method === 'cash') data.day.cash += price;
        else if (method === 'bizum') data.day.bizum += price;
        else if (method) data.day.otro += price;
        data.day.byTeam[team].clients += 1;
        data.day.byTeam[team].revenue += price;
      }

      if (app.date >= startOfWeekStr && app.date <= endOfWeekStr) {
        data.week.clients += 1;
        data.week.revenue += price;
        if (method === 'cash') data.week.cash += price;
        else if (method === 'bizum') data.week.bizum += price;
        else if (method) data.week.otro += price;
        data.week.byTeam[team].clients += 1;
        data.week.byTeam[team].revenue += price;
      }

      if (app.date >= startOfMonthStr && app.date <= endOfMonth) {
        data.month.clients += 1;
        data.month.revenue += price;
        if (method === 'cash') data.month.cash += price;
        else if (method === 'bizum') data.month.bizum += price;
        else if (method) data.month.otro += price;
        data.month.byTeam[team].clients += 1;
        data.month.byTeam[team].revenue += price;
      }

      if (app.date >= startOfYearStr && app.date <= endOfYearStr) {
        data.year.clients += 1;
        data.year.revenue += price;
        if (method === 'cash') data.year.cash += price;
        else if (method === 'bizum') data.year.bizum += price;
        else if (method) data.year.otro += price;
        data.year.byTeam[team].clients += 1;
        data.year.byTeam[team].revenue += price;
      }
    });

    expenses.forEach(exp => {
      if (!exp.date) return;
      const amount = parseFloat(exp.amount) || 0;
      
      if (exp.date === todayStr) data.day.expenses += amount;
      if (exp.date >= startOfWeekStr && exp.date <= endOfWeekStr) data.week.expenses += amount;
      if (exp.date >= startOfMonthStr && exp.date <= endOfMonth) data.month.expenses += amount;
      if (exp.date >= startOfYearStr && exp.date <= endOfYearStr) data.year.expenses += amount;
    });

    return { ...data, pendingPayments, cancelledAppointments };
  }, [appointments, expenses]);

  if (loading) {
    return <ActivityIndicator size="large" color="#D48A9A" style={{ flex: 1, justifyContent: 'center' }} />;
  }

  const renderStatCard = (title: string, periodData: any) => {
    // Filter teams that actually have data for this period to avoid showing 0s
    const activeTeams = Object.keys(periodData.byTeam).filter(
      team => periodData.byTeam[team].clients > 0 || periodData.byTeam[team].revenue > 0
    );

    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{title}</Text>
        <View style={[styles.summaryRow, {flexWrap: 'wrap', gap: 10}]}>
          <View style={[styles.summaryBox, {minWidth: '40%'}]}>
            <Text style={styles.summaryLabel}>Clientes</Text>
            <Text style={styles.summaryValue}>{periodData.clients}</Text>
          </View>
          <View style={[styles.summaryBox, {minWidth: '40%'}]}>
            <Text style={styles.summaryLabel}>Ingresos</Text>
            <Text style={[styles.summaryValue, {color: '#4a9b40'}]}>+{periodData.revenue.toFixed(2)} €</Text>
            {(periodData.cash > 0 || periodData.bizum > 0 || periodData.otro > 0) && (
              <View style={{marginTop: 5}}>
                {periodData.cash > 0 && <Text style={{fontSize: 11, color: '#666'}}>💵 Efe: {periodData.cash.toFixed(2)}€</Text>}
                {periodData.bizum > 0 && <Text style={{fontSize: 11, color: '#666'}}>📱 Biz: {periodData.bizum.toFixed(2)}€</Text>}
                {periodData.otro > 0 && <Text style={{fontSize: 11, color: '#666'}}>💳 Otr: {periodData.otro.toFixed(2)}€</Text>}
              </View>
            )}
          </View>
          {periodData.expenses !== undefined && (
            <View style={[styles.summaryBox, {minWidth: '40%'}]}>
              <Text style={styles.summaryLabel}>Gastos</Text>
              <Text style={[styles.summaryValue, {color: '#e74c3c'}]}>-{periodData.expenses.toFixed(2)} €</Text>
            </View>
          )}
          {periodData.expenses !== undefined && (
            <View style={[styles.summaryBox, {minWidth: '40%'}]}>
              <Text style={styles.summaryLabel}>Beneficio Neto</Text>
              <Text style={[styles.summaryValue, {color: (periodData.revenue - periodData.expenses) >= 0 ? '#4a9b40' : '#e74c3c'}]}>
                {(periodData.revenue - periodData.expenses) >= 0 ? '+' : ''}{(periodData.revenue - periodData.expenses).toFixed(2)} €
              </Text>
            </View>
          )}
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
      {renderStatCard('Este Año', stats.year)}

      {/* TARJETA DE DEUDAS / PAGOS PENDIENTES */}
      <View style={styles.card}>
        <Text style={[styles.cardTitle, {color: '#f39c12'}]}>⏳ Deudas y Pagos Pendientes</Text>
        {stats.pendingPayments.length > 0 ? (
          stats.pendingPayments.map((app: any) => (
            <View key={app.id} style={[styles.teamRow, {flexDirection: 'column', alignItems: 'flex-start'}]}>
              <View style={{flexDirection: 'row', justifyContent: 'space-between', width: '100%'}}>
                <View>
                  <Text style={styles.teamName}>👤 {app.client}</Text>
                  <Text style={styles.teamStats}>📅 {app.date} - ✨ {app.serviceName}</Text>
                  <Text style={[styles.teamStats, {color: '#D48A9A', fontWeight: 'bold', marginTop: 2}]}>💇‍♀️ Atendido por: {app.team || 'Sin asignar'}</Text>
                </View>
                <Text style={[styles.summaryValue, {fontSize: 18, color: '#f39c12'}]}>{app.finalPrice} €</Text>
              </View>
              <View style={{flexDirection: 'row', gap: 6, alignSelf: 'flex-end', marginTop: 10, flexWrap: 'wrap', justifyContent: 'flex-end'}}>
                <TouchableOpacity 
                  style={[styles.btnAction, {backgroundColor: '#4a9b40', paddingVertical: 8}]}
                  onPress={() => handleMarkAsPaid(app.id, 'cash')}
                >
                  <Text style={styles.btnText}>💵 Efectivo</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.btnAction, {backgroundColor: '#00a4bd', paddingVertical: 8}]}
                  onPress={() => handleMarkAsPaid(app.id, 'bizum')}
                >
                  <Text style={styles.btnText}>📱 Bizum</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.btnAction, {backgroundColor: '#9b59b6', paddingVertical: 8}]}
                  onPress={() => handleMarkAsPaid(app.id, 'otro')}
                >
                  <Text style={styles.btnText}>💳 Otro</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.noDataText}>No hay pagos pendientes de cobro.</Text>
        )}
      </View>

      {/* TARJETA DE CITAS CANCELADAS */}
      <View style={styles.card}>
        <Text style={[styles.cardTitle, {color: '#e74c3c'}]}>🚫 Registro de Citas Canceladas</Text>
        {stats.cancelledAppointments.length > 0 ? (
          stats.cancelledAppointments.map((app: any) => {
            let noticeText = 'Desconocido';
            if (app.cancelledAt) {
              const scheduledDate = new Date(`${app.date}T${app.time || '00:00'}:00`);
              const cancelledDate = new Date(app.cancelledAt);
              const diffMs = scheduledDate.getTime() - cancelledDate.getTime();
              
              if (diffMs < 0) {
                noticeText = `Cancelada ${Math.round(Math.abs(diffMs) / (1000 * 60 * 60))}h después (No-show)`;
              } else {
                const diffHours = diffMs / (1000 * 60 * 60);
                if (diffHours < 24) {
                  noticeText = `Cancelada con ${Math.round(diffHours)}h de antelación`;
                } else {
                  noticeText = `Cancelada con ${Math.round(diffHours / 24)} días de antelación`;
                }
              }
            }

            return (
              <View key={app.id} style={[styles.teamRow, {flexDirection: 'column', alignItems: 'flex-start'}]}>
                <Text style={styles.teamName}>👤 {app.client}</Text>
                <Text style={styles.teamStats}>📅 {app.date} a las {app.time} - ✨ {app.serviceName}</Text>
                <Text style={[styles.teamStats, {color: '#e74c3c', fontWeight: 'bold', marginTop: 2}]}>
                  ⏰ {noticeText}
                </Text>
              </View>
            );
          })
        ) : (
          <Text style={styles.noDataText}>No hay citas canceladas registradas.</Text>
        )}
      </View>

      {/* TARJETA DE LIMPIEZA DE BASE DE DATOS */}
      <View style={styles.card}>
        <Text style={[styles.cardTitle, {color: '#8e44ad'}]}>🧹 Mantenimiento de Base de Datos</Text>
        <Text style={{color: '#555', fontSize: 13, marginBottom: 15}}>
          Borra citas con más de 3 meses de antigüedad para liberar espacio y acelerar la aplicación. 
          Los ingresos generados por esas citas se archivarán en un registro histórico para que no los pierdas.
        </Text>
        <TouchableOpacity 
          style={[styles.btnAction, {backgroundColor: '#8e44ad', alignSelf: 'flex-start', paddingHorizontal: 20}]}
          onPress={handleFreeUpSpace}
        >
          <Text style={styles.btnText}>🗑️ Liberar espacio (Citas &gt; 3 meses)</Text>
        </TouchableOpacity>
      </View>

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
              <View key={t.id} style={[styles.teamRow, {flexDirection: 'column', alignItems: 'stretch'}]}>
                <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10}}>
                  <Text style={styles.teamName}>💇‍♀️ {t.name} (PIN: {t.pin || '1234'})</Text>
                  <TouchableOpacity onPress={() => handleDeleteTeam(t.id)} style={styles.delBtn}>
                    <Text style={styles.delBtnText}>🗑️ Eliminar</Text>
                  </TouchableOpacity>
                </View>
                <View style={{flexDirection: 'row', alignItems: 'center'}}>
                  <TextInput
                    style={[styles.input, {flex: 1, marginRight: 10, paddingVertical: 8, marginBottom: 0}]}
                    placeholder="Nuevo PIN (4 dígitos)"
                    keyboardType="numeric"
                    maxLength={4}
                    onChangeText={(text) => t.newPin = text}
                  />
                  <TouchableOpacity 
                    style={[styles.btnAction, {paddingVertical: 12, paddingHorizontal: 15}]} 
                    onPress={async () => {
                      if (!t.newPin || t.newPin.length !== 4) return alert('El PIN debe tener 4 dígitos.');
                      try {
                        const { doc, updateDoc } = require('firebase/firestore');
                        await updateDoc(doc(db, 'teams', t.id), { pin: t.newPin });
                        alert(`PIN de ${t.name} actualizado.`);
                      } catch(e) {
                        alert('Error al actualizar PIN.');
                      }
                    }}
                  >
                    <Text style={[styles.btnText, {fontSize: 14}]}>Cambiar PIN</Text>
                  </TouchableOpacity>
                </View>
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
  mainTitle: { fontSize: 22, fontWeight: 'bold', color: '#D48A9A', marginBottom: 20, textAlign: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 15, marginBottom: 15, elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowOffset: {width: 0, height: 2} },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  summaryBox: { alignItems: 'center', flex: 1 },
  summaryLabel: { fontSize: 14, color: '#666', marginBottom: 5 },
  summaryValue: { fontSize: 24, fontWeight: 'bold', color: '#D48A9A' },
  subtitle: { fontSize: 14, fontWeight: '600', color: '#444', marginBottom: 10 },
  teamRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  teamName: { fontSize: 14, color: '#333', fontWeight: '500' },
  teamStats: { fontSize: 14, color: '#666' },
  noDataText: { fontSize: 14, color: '#999', fontStyle: 'italic', textAlign: 'center', marginTop: 10 },
  inputRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  input: { flex: 1, backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#ddd', padding: 10, borderRadius: 6 },
  btnAction: { backgroundColor: '#D48A9A', paddingVertical: 12, paddingHorizontal: 15, borderRadius: 6 },
  btnText: { color: '#fff', fontWeight: 'bold' },
  delBtn: { padding: 8, backgroundColor: '#ffebee', borderRadius: 4 },
  delBtnText: { color: '#d32f2f', fontSize: 12, fontWeight: 'bold' }
});
