import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TextInput, TouchableOpacity, Modal } from 'react-native';
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

const formatYMD = (d: Date) => d.toISOString().split('T')[0];

const formatHours = (mins: number) => {
  if (!mins) return '0h';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
};

export default function DashboardScreen() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtros y Vista
  const [dateFilter, setDateFilter] = useState<'week'|'month'|'year'|'all'>('month');
  const [showSettings, setShowSettings] = useState(false);
  const [widgets, setWidgets] = useState({
    chart: true,
    metrics: true,
    teams: true,
    pending: true,
    cancelled: true,
    admin: true
  });

  // Admin Config
  const [adminConfig, setAdminConfig] = useState({ pin: '1234', managementPin: '1234', pinEnabled: true });
  const [newPin, setNewPin] = useState('');
  const [newManagementPin, setNewManagementPin] = useState('');

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
    const { doc } = require('firebase/firestore');
    const unsub = onSnapshot(doc(db, 'config', 'admin'), (docSnap: any) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setAdminConfig({ pinEnabled: data.pinEnabled, pin: data.pin, managementPin: data.managementPin });
      }
    });
    return () => unsub();
  }, []);

  const stats = useMemo(() => {
    let startStr = '2000-01-01';
    let endStr = '2100-01-01';
    const now = new Date();
    
    if (dateFilter === 'week') {
      startStr = formatYMD(getStartOfWeek(now));
      const end = new Date(getStartOfWeek(now)); end.setDate(end.getDate() + 6);
      endStr = formatYMD(end);
    } else if (dateFilter === 'month') {
      startStr = formatYMD(getStartOfMonth(now));
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      endStr = formatYMD(end);
    } else if (dateFilter === 'year') {
      startStr = formatYMD(getStartOfYear(now));
      endStr = formatYMD(new Date(now.getFullYear(), 11, 31));
    }

    let revenue = 0, expTotal = 0, clients = 0, pending = 0, cash = 0, bizum = 0, otro = 0;
    const byTeam: Record<string, any> = {};
    const pendingList: any[] = [];
    const cancelledList: any[] = [];
    const chartDataMap: Record<string, number> = {};

    appointments.forEach(app => {
      if (!app.date || app.date < startStr || app.date > endStr) return;

      const team = app.team || 'Sin asignar';
      if (!byTeam[team]) byTeam[team] = { clients: 0, revenue: 0, pending: 0, cancelled: 0, workedMins: 0, blockedMins: 0 };
      
      let isCancelled = app.status === 'cancelled';
      let isBloqueo = (app.serviceName && app.serviceName.toLowerCase().includes('bloquead')) || (app.client && app.client.toLowerCase().includes('bloquead'));
      let durationMins = parseInt(app.duration || '0');

      if (isCancelled) {
        byTeam[team].cancelled++;
        cancelledList.push(app);
        return;
      }

      if (isBloqueo) {
        byTeam[team].blockedMins += durationMins;
      } else {
        clients++;
        byTeam[team].clients++;
        byTeam[team].workedMins += durationMins;

        let price = 0;
        if (app.status === 'completed' && app.paymentStatus === 'paid' && app.finalPrice) {
          price = parseFloat(app.finalPrice) || 0;
          revenue += price;
          byTeam[team].revenue += price;
          
          if (app.paymentMethod === 'cash') cash += price;
          else if (app.paymentMethod === 'bizum') bizum += price;
          else otro += price;

          chartDataMap[app.date] = (chartDataMap[app.date] || 0) + price;
        }

        if (app.paymentStatus === 'pending') {
          const val = parseFloat(app.finalPrice || app.price) || 0;
          pending += val;
          byTeam[team].pending += val;
          pendingList.push(app);
        }
      }
    });

    expenses.forEach(ex => {
      if (!ex.date || ex.date < startStr || ex.date > endStr) return;
      expTotal += parseFloat(ex.amount) || 0;
    });

    let chartLabels: string[] = [];
    let chartValues: number[] = [];
    if (dateFilter === 'week') {
      const days = ['L','M','X','J','V','S','D'];
      let cur = new Date(startStr);
      for(let i=0; i<7; i++) {
        const dStr = formatYMD(cur);
        chartLabels.push(days[i]);
        chartValues.push(chartDataMap[dStr] || 0);
        cur.setDate(cur.getDate() + 1);
      }
    } else if (dateFilter === 'month') {
      chartLabels = ['Sem1', 'Sem2', 'Sem3', 'Sem4', 'Sem5'];
      chartValues = [0,0,0,0,0];
      Object.keys(chartDataMap).forEach(d => {
        const day = parseInt(d.split('-')[2]);
        const wk = Math.min(Math.floor((day-1)/7), 4);
        chartValues[wk] += chartDataMap[d];
      });
    } else if (dateFilter === 'year' || dateFilter === 'all') {
      chartLabels = ['E','F','M','A','M','J','J','A','S','O','N','D'];
      chartValues = Array(12).fill(0);
      Object.keys(chartDataMap).forEach(d => {
        const month = parseInt(d.split('-')[1]) - 1;
        chartValues[month] += chartDataMap[d];
      });
    }

    const maxChartValue = Math.max(...chartValues, 1);

    return { 
      revenue, expTotal, clients, pending, cash, bizum, otro, 
      byTeam, pendingList, cancelledList, chartLabels, chartValues, maxChartValue 
    };
  }, [appointments, expenses, dateFilter]);

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

  const handleUpdateManagementPin = async () => {
    if (newManagementPin.length !== 4) return alert('El PIN debe tener 4 números.');
    try {
      const { doc, setDoc } = require('firebase/firestore');
      await setDoc(doc(db, 'config', 'admin'), { managementPin: newManagementPin }, { merge: true });
      alert('PIN de AvalonMystic actualizado con éxito.');
      setNewManagementPin('');
    } catch (e) {
      alert('Error al guardar el PIN.');
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
        const batch = writeBatch(db);
        snap.forEach((d: any) => {
            const data = d.data();
            if (data.status === 'completed' && data.paymentStatus === 'paid') {
                totalRevenueArchived += parseFloat(data.finalPrice) || 0;
            }
            batch.delete(d.ref);
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
        alert('Limpieza completada con éxito.');
    } catch (e) {
        alert('Error al limpiar la base de datos.');
    }
  };

  const toggleWidget = (key: keyof typeof widgets) => setWidgets(w => ({...w, [key]: !w[key]}));

  if (loading) return <ActivityIndicator size="large" color="#D48A9A" style={{marginTop: 50}} />;

  return (
    <ScrollView style={styles.container}>
      {/* CABECERA Y FILTROS */}
      <View style={styles.header}>
        <Text style={styles.mainTitle}>Dashboard Analytics</Text>
        <TouchableOpacity style={styles.settingsBtn} onPress={() => setShowSettings(true)}>
          <Text style={{fontSize: 20}}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterBar}>
        <TouchableOpacity style={[styles.filterBtn, dateFilter === 'week' && styles.filterBtnActive]} onPress={() => setDateFilter('week')}>
          <Text style={[styles.filterText, dateFilter === 'week' && styles.filterTextActive]}>Semana</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.filterBtn, dateFilter === 'month' && styles.filterBtnActive]} onPress={() => setDateFilter('month')}>
          <Text style={[styles.filterText, dateFilter === 'month' && styles.filterTextActive]}>Mes</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.filterBtn, dateFilter === 'year' && styles.filterBtnActive]} onPress={() => setDateFilter('year')}>
          <Text style={[styles.filterText, dateFilter === 'year' && styles.filterTextActive]}>Año</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.filterBtn, dateFilter === 'all' && styles.filterBtnActive]} onPress={() => setDateFilter('all')}>
          <Text style={[styles.filterText, dateFilter === 'all' && styles.filterTextActive]}>Todo</Text>
        </TouchableOpacity>
      </View>

      {/* MÉTRICAS PRINCIPALES */}
      {widgets.metrics && (
        <View style={styles.metricsContainer}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Ingresos Brutos</Text>
            <Text style={[styles.metricValue, {color: '#2ecc71'}]}>{stats.revenue.toFixed(2)} €</Text>
            <View style={{flexDirection: 'row', marginTop: 5, justifyContent: 'space-between', width: '100%'}}>
               <Text style={{fontSize: 10, color: '#888'}}>💵 {stats.cash.toFixed(0)}€</Text>
               <Text style={{fontSize: 10, color: '#888'}}>📱 {stats.bizum.toFixed(0)}€</Text>
               <Text style={{fontSize: 10, color: '#888'}}>💳 {stats.otro.toFixed(0)}€</Text>
            </View>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Gastos</Text>
            <Text style={[styles.metricValue, {color: '#e74c3c'}]}>-{stats.expTotal.toFixed(2)} €</Text>
            <Text style={{fontSize: 11, color: '#888', marginTop: 5}}>Neto: {(stats.revenue - stats.expTotal).toFixed(2)}€</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Citas Totales</Text>
            <Text style={[styles.metricValue, {color: '#D48A9A'}]}>{stats.clients}</Text>
          </View>
        </View>
      )}

      {/* GRÁFICO DE INGRESOS */}
      {widgets.chart && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📈 Evolución de Ingresos</Text>
          <View style={styles.chartContainer}>
            {stats.chartValues.map((val, i) => {
              const height = (val / stats.maxChartValue) * 120; // 120px max height
              return (
                <View key={i} style={styles.chartCol}>
                  <Text style={styles.chartValueText}>{val > 0 ? Math.round(val) : ''}</Text>
                  <View style={[styles.chartBar, {height: height > 0 ? height : 2}]} />
                  <Text style={styles.chartLabelText}>{stats.chartLabels[i]}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* RENDIMIENTO POR EMPLEADA */}
      {widgets.teams && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>👩‍💻 Rendimiento del Equipo</Text>
          {Object.keys(stats.byTeam).map(team => {
            const tData = stats.byTeam[team];
            return (
              <View key={team} style={styles.teamRow}>
                <View>
                  <Text style={styles.teamName}>{team}</Text>
                  <Text style={styles.teamStats}>✅ {tData.clients} citas | ❌ {tData.cancelled} canceladas</Text>
                  <Text style={[styles.teamStats, {color: '#888', marginTop: 2}]}>
                    ⏱ Trab: {formatHours(tData.workedMins)} | ⏸️ Bloq: {formatHours(tData.blockedMins)}
                  </Text>
                </View>
                <View style={{alignItems: 'flex-end'}}>
                  <Text style={{fontWeight: 'bold', color: '#2ecc71', fontSize: 15}}>{tData.revenue.toFixed(2)} €</Text>
                  <Text style={{fontSize: 12, color: '#f39c12'}}>⏳ {tData.pending.toFixed(2)} €</Text>
                </View>
              </View>
            );
          })}
          {Object.keys(stats.byTeam).length === 0 && <Text style={styles.noDataText}>No hay datos en este periodo.</Text>}
        </View>
      )}

      {/* PAGOS PENDIENTES */}
      {widgets.pending && (
        <View style={styles.card}>
          <Text style={[styles.cardTitle, {color: '#f39c12'}]}>⏳ Pagos Pendientes</Text>
          {stats.pendingList.length > 0 ? (
            stats.pendingList.map((app: any) => (
              <View key={app.id} style={styles.teamRow}>
                <View>
                  <Text style={styles.teamName}>👤 {app.client}</Text>
                  <Text style={styles.teamStats}>📅 {app.date} - 💶 {app.finalPrice || app.price}€</Text>
                </View>
                <View style={{flexDirection: 'row'}}>
                  <TouchableOpacity style={styles.payBtn} onPress={() => handleMarkAsPaid(app.id, 'cash')}>
                    <Text style={styles.btnTextSmall}>Efe</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.payBtn} onPress={() => handleMarkAsPaid(app.id, 'bizum')}>
                    <Text style={styles.btnTextSmall}>Biz</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.payBtn} onPress={() => handleMarkAsPaid(app.id, 'otro')}>
                    <Text style={styles.btnTextSmall}>Otr</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.noDataText}>Todo está al día.</Text>
          )}
        </View>
      )}

      {/* CITAS CANCELADAS */}
      {widgets.cancelled && (
        <View style={styles.card}>
          <Text style={[styles.cardTitle, {color: '#e74c3c'}]}>🚫 Citas Canceladas</Text>
          {stats.cancelledList.length > 0 ? (
            stats.cancelledList.map((app: any) => {
              let noticeText = 'Desconocida';
              if (app.cancelledAt) {
                const diffMs = new Date(`${app.date}T${app.time || '00:00'}:00`).getTime() - new Date(app.cancelledAt).getTime();
                if (diffMs < 0) noticeText = 'No-show / Tarde';
                else noticeText = `Con ${Math.round(diffMs / 3600000)}h antelación`;
              }
              return (
                <View key={app.id} style={styles.teamRow}>
                  <View>
                    <Text style={styles.teamName}>👤 {app.client}</Text>
                    <Text style={styles.teamStats}>📅 {app.date} - ✨ {app.serviceName}</Text>
                    <Text style={[styles.teamStats, {color: '#e74c3c'}]}>⏰ {noticeText}</Text>
                  </View>
                </View>
              );
            })
          ) : (
            <Text style={styles.noDataText}>No hay cancelaciones.</Text>
          )}
        </View>
      )}

      {/* SECCIÓN ADMIN */}
      {widgets.admin && (
        <>
          <View style={styles.card}>
            <Text style={[styles.cardTitle, {color: '#8e44ad'}]}>🧹 Mantenimiento de BD</Text>
            <TouchableOpacity style={[styles.btnAction, {backgroundColor: '#8e44ad'}]} onPress={handleFreeUpSpace}>
              <Text style={styles.btnText}>🗑️ Liberar espacio (Citas antiguas)</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>⚙️ Configuración de Accesos</Text>
            <Text style={styles.subtitle}>PIN de Administrador</Text>
            <View style={styles.inputRow}>
              <TextInput style={styles.input} placeholder="4 dígitos" keyboardType="numeric" maxLength={4} value={newPin} onChangeText={setNewPin} />
              <TouchableOpacity style={styles.btnAction} onPress={handleUpdatePin}><Text style={styles.btnText}>Guardar</Text></TouchableOpacity>
            </View>
            <Text style={[styles.subtitle, {marginTop: 15}]}>PIN de AvalonMystic</Text>
            <View style={styles.inputRow}>
              <TextInput style={styles.input} placeholder="4 dígitos" keyboardType="numeric" maxLength={4} value={newManagementPin} onChangeText={setNewManagementPin} />
              <TouchableOpacity style={styles.btnAction} onPress={handleUpdateManagementPin}><Text style={styles.btnText}>Guardar</Text></TouchableOpacity>
            </View>
          </View>
        </>
      )}

      <View style={{height: 40}} />

      {/* MODAL CONFIGURACIÓN WIDGETS */}
      <Modal visible={showSettings} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Personalizar Dashboard</Text>
            <Text style={{color: '#666', marginBottom: 15, fontSize: 13}}>Marca las tarjetas que quieres ver.</Text>
            
            <View style={styles.toggleRow}>
              <Text>Métricas (Cajas Arriba)</Text>
              <TouchableOpacity onPress={() => toggleWidget('metrics')}><Text style={{fontSize: 22}}>{widgets.metrics ? '☑️' : '☐'}</Text></TouchableOpacity>
            </View>
            <View style={styles.toggleRow}>
              <Text>Gráfico de Ingresos</Text>
              <TouchableOpacity onPress={() => toggleWidget('chart')}><Text style={{fontSize: 22}}>{widgets.chart ? '☑️' : '☐'}</Text></TouchableOpacity>
            </View>
            <View style={styles.toggleRow}>
              <Text>Rendimiento del Equipo</Text>
              <TouchableOpacity onPress={() => toggleWidget('teams')}><Text style={{fontSize: 22}}>{widgets.teams ? '☑️' : '☐'}</Text></TouchableOpacity>
            </View>
            <View style={styles.toggleRow}>
              <Text>Pagos Pendientes</Text>
              <TouchableOpacity onPress={() => toggleWidget('pending')}><Text style={{fontSize: 22}}>{widgets.pending ? '☑️' : '☐'}</Text></TouchableOpacity>
            </View>
            <View style={styles.toggleRow}>
              <Text>Citas Canceladas</Text>
              <TouchableOpacity onPress={() => toggleWidget('cancelled')}><Text style={{fontSize: 22}}>{widgets.cancelled ? '☑️' : '☐'}</Text></TouchableOpacity>
            </View>
            <View style={styles.toggleRow}>
              <Text>Herramientas de Admin</Text>
              <TouchableOpacity onPress={() => toggleWidget('admin')}><Text style={{fontSize: 22}}>{widgets.admin ? '☑️' : '☐'}</Text></TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.modalBtn} onPress={() => setShowSettings(false)}>
              <Text style={styles.modalBtnText}>Guardar Vista</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f4f7', padding: 15 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  mainTitle: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  settingsBtn: { padding: 8, backgroundColor: '#fff', borderRadius: 8, elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowOffset: {width: 0, height: 1} },
  
  filterBar: { flexDirection: 'row', backgroundColor: '#e0e8f0', borderRadius: 12, padding: 4, marginBottom: 20 },
  filterBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  filterBtnActive: { backgroundColor: '#fff', elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowOffset: {width: 0, height: 1} },
  filterText: { color: '#666', fontWeight: 'bold', fontSize: 13 },
  filterTextActive: { color: '#D48A9A', fontWeight: 'bold' },

  metricsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  metricCard: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 15, marginHorizontal: 4, alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: {width: 0, height: 2} },
  metricLabel: { fontSize: 11, color: '#888', fontWeight: 'bold', marginBottom: 5, textAlign: 'center' },
  metricValue: { fontSize: 18, fontWeight: 'bold' },

  card: { backgroundColor: '#fff', borderRadius: 14, padding: 18, marginBottom: 15, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: {width: 0, height: 2} },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#444', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', paddingBottom: 10 },
  noDataText: { color: '#888', fontStyle: 'italic', textAlign: 'center', marginVertical: 10 },

  chartContainer: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 150, paddingTop: 10 },
  chartCol: { alignItems: 'center', justifyContent: 'flex-end', flex: 1 },
  chartBar: { width: 14, backgroundColor: '#D48A9A', borderRadius: 4, opacity: 0.8 },
  chartLabelText: { fontSize: 10, color: '#999', marginTop: 4 },
  chartValueText: { fontSize: 9, color: '#D48A9A', marginBottom: 2, fontWeight: 'bold' },

  teamRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  teamName: { fontWeight: 'bold', fontSize: 14, color: '#333' },
  teamStats: { fontSize: 12, color: '#666', marginTop: 2 },
  
  payBtn: { backgroundColor: '#f5f7fa', borderWidth: 1, borderColor: '#e0e8f0', borderRadius: 6, paddingVertical: 6, paddingHorizontal: 10, marginLeft: 5 },
  btnTextSmall: { fontSize: 12, color: '#333', fontWeight: 'bold' },

  subtitle: { fontSize: 14, fontWeight: 'bold', color: '#555', marginBottom: 10 },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#eee', padding: 10, borderRadius: 8, marginRight: 10 },
  btnAction: { backgroundColor: '#D48A9A', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8 },
  btnText: { color: '#fff', fontWeight: 'bold' },

  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { backgroundColor: '#fff', width: '85%', borderRadius: 14, padding: 20, elevation: 5 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 5 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  modalBtn: { backgroundColor: '#333', paddingVertical: 14, borderRadius: 8, marginTop: 20, alignItems: 'center' },
  modalBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 }
});
