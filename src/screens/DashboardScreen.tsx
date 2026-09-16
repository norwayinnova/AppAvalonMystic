import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator
} from 'react-native';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../config/firebase';

type TimeFilter = 'dia' | 'semana' | 'mes' | 'rango';

export default function DashboardScreen() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Configuración de Seguridad
  const [adminConfig, setAdminConfig] = useState({ pinEnabled: true, pin: '1234' });
  const [editingPinEnabled, setEditingPinEnabled] = useState(true);
  const [editingPin, setEditingPin] = useState('1234');

  // Filtros globales
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('mes');
  const [selectedTeam, setSelectedTeam] = useState('Todos');
  const [customStartDate, setCustomStartDate] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [customEndDate, setCustomEndDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [selectedDay, setSelectedDay] = useState(
    new Date().toISOString().split('T')[0]
  );

  // 1. Cargar Citas
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

  // 2. Cargar Clientes
  useEffect(() => {
    const qClients = query(collection(db, 'clients'));
    const unsub = onSnapshot(qClients, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach(docSnap => list.push({ id: docSnap.id, ...docSnap.data() }));
      setClients(list);
    });
    return () => unsub();
  }, []);

  // 3. Cargar Equipos
  useEffect(() => {
    const qTeams = query(collection(db, 'teams'));
    const unsub = onSnapshot(qTeams, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach(docSnap => list.push({ id: docSnap.id, ...docSnap.data() }));
      list.sort((a, b) => a.name.localeCompare(b.name));
      setTeams(list);
    });
    return () => unsub();
  }, []);

  // 4. Cargar Gastos
  useEffect(() => {
    const qExpenses = query(collection(db, 'expenses'));
    const unsub = onSnapshot(qExpenses, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach(docSnap => list.push({ id: docSnap.id, ...docSnap.data() }));
      setExpenses(list);
    });
    return () => unsub();
  }, []);

  // 5. Cargar Inventario
  useEffect(() => {
    const qInv = query(collection(db, 'inventory'));
    const unsub = onSnapshot(qInv, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach(docSnap => list.push({ id: docSnap.id, ...docSnap.data() }));
      setInventory(list);
    });
    return () => unsub();
  }, []);

  // 6. Cargar Configuración Admin
  useEffect(() => {
    const { doc } = require('firebase/firestore');
    const unsub = onSnapshot(doc(db, 'config', 'admin'), (docSnap: any) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setAdminConfig({ pinEnabled: data.pinEnabled, pin: data.pin });
        setEditingPinEnabled(data.pinEnabled);
        setEditingPin(data.pin);
      }
    });
    return () => unsub();
  }, []);

  // Calcular rango de fechas según el filtro seleccionado
  const dateRange = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (timeFilter === 'dia') {
      return { start: selectedDay, end: selectedDay };
    }
    if (timeFilter === 'semana') {
      const startOfWeek = new Date(now);
      const day = startOfWeek.getDay() || 7; // 1 = Lunes, 7 = Domingo
      startOfWeek.setDate(startOfWeek.getDate() - day + 1);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6);
      return {
        start: startOfWeek.toISOString().split('T')[0],
        end: endOfWeek.toISOString().split('T')[0]
      };
    }
    if (timeFilter === 'mes') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return {
        start: startOfMonth.toISOString().split('T')[0],
        end: endOfMonth.toISOString().split('T')[0]
      };
    }
    return { start: customStartDate, end: customEndDate };
  }, [timeFilter, selectedDay, customStartDate, customEndDate]);

  // Citas filtradas por Fecha y Equipo
  const filteredAppointments = useMemo(() => {
    return appointments.filter((app) => {
      const appDate = app.date;
      if (!appDate) return false;
      const inDateRange = appDate >= dateRange.start && appDate <= dateRange.end;
      const matchTeam = selectedTeam === 'Todos' ? true : (app.team || 'Equipo 1') === selectedTeam;
      return inDateRange && matchTeam;
    });
  }, [appointments, dateRange, selectedTeam]);

  // Gastos filtrados por Fecha y Equipo
  const filteredExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      const expDate = exp.date;
      if (!expDate) return false;
      const inDateRange = expDate >= dateRange.start && expDate <= dateRange.end;
      const matchTeam = selectedTeam === 'Todos' ? true : (exp.team || 'Oficina/General') === selectedTeam;
      return inDateRange && matchTeam;
    });
  }, [expenses, dateRange, selectedTeam]);

  // 1. CÁLCULO DE FINANZAS (Facturación - Gastos = Beneficio)
  const billingStats = useMemo(() => {
    let totalIncome = 0;
    let totalExpenses = 0;
    const byTeam: Record<string, number> = {};

    filteredAppointments.forEach((app) => {
      const price = parseFloat(app.price || '0');
      const val = isNaN(price) ? 0 : price;
      totalIncome += val;

      const teamName = app.team || 'Equipo 1';
      byTeam[teamName] = (byTeam[teamName] || 0) + val;
    });

    filteredExpenses.forEach((exp) => {
      const amount = parseFloat(exp.amount || '0');
      totalExpenses += isNaN(amount) ? 0 : amount;
    });

    const netProfit = totalIncome - totalExpenses;

    return { totalIncome, totalExpenses, netProfit, byTeam };
  }, [filteredAppointments, filteredExpenses]);

  // 2. CÁLCULO DE RENDIMIENTO POR SERVICIO
  const servicesStats = useMemo(() => {
    const totalCount = filteredAppointments.length;
    let totalBilling = 0;
    let totalDurationMins = 0;
    const byService: Record<string, number> = {};
    const byTeamCount: Record<string, number> = {};

    filteredAppointments.forEach((app) => {
      // 1. Conteo por nombre
      const sName = app.serviceName || 'Servicio general';
      byService[sName] = (byService[sName] || 0) + 1;

      // 2. Conteo por equipo
      const tName = app.team || 'Equipo 1';
      byTeamCount[tName] = (byTeamCount[tName] || 0) + 1;
      
      // 3. Facturación
      const price = parseFloat(app.price || '0');
      totalBilling += isNaN(price) ? 0 : price;
      
      // 4. Duración
      const dur = parseInt(app.duration || '60');
      totalDurationMins += isNaN(dur) ? 0 : dur;
    });

    const averageTicket = totalCount > 0 ? Math.round(totalBilling / totalCount) : 0;
    const averageDurationMins = totalCount > 0 ? Math.round(totalDurationMins / totalCount) : 0;

    const topServices = Object.entries(byService)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return { totalCount, totalBilling, averageTicket, totalDurationMins, averageDurationMins, byTeamCount, topServices };
  }, [filteredAppointments]);

  // 3. CÁLCULO DE EFICIENCIA DE HORARIO
  const efficiencyStats = useMemo(() => {
    // Agrupar citas por día y por equipo
    const daysMap: Record<string, Record<string, any[]>> = {};

    filteredAppointments.forEach((app) => {
      if (!app.date || !app.time) return;
      const tName = app.team || 'Equipo 1';
      if (!daysMap[app.date]) daysMap[app.date] = {};
      if (!daysMap[app.date][tName]) daysMap[app.date][tName] = [];
      daysMap[app.date][tName].push(app);
    });

    const getMinutes = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };

    let totalServiceMinutes = 0;
    let totalSpanMinutes = 0;
    let activeDaysCount = 0;

    Object.keys(daysMap).forEach((d) => {
      Object.keys(daysMap[d]).forEach((tName) => {
        const dayApps = daysMap[d][tName].sort((a, b) => a.time.localeCompare(b.time));
        if (dayApps.length === 0) return;

        // Horas reales en servicio de limpieza
        let dayServiceMins = 0;
        dayApps.forEach((a) => {
          dayServiceMins += parseInt(a.duration || '60');
        });

        // Tiempo total transcurrido desde inicio primer servicio hasta fin del último
        const firstStart = getMinutes(dayApps[0].time);
        const lastApp = dayApps[dayApps.length - 1];
        const lastEnd = getMinutes(lastApp.time) + parseInt(lastApp.duration || '60');
        const daySpan = Math.max(lastEnd - firstStart, dayServiceMins);

        totalServiceMinutes += dayServiceMins;
        totalSpanMinutes += daySpan;
        activeDaysCount++;
      });
    });

    const efficiencyPct = totalSpanMinutes > 0
      ? Math.round((totalServiceMinutes / totalSpanMinutes) * 100)
      : 0;

    const serviceHours = (totalServiceMinutes / 60).toFixed(1);
    const deadOrTravelHours = Math.max(0, (totalSpanMinutes - totalServiceMinutes) / 60).toFixed(1);

    return { efficiencyPct, serviceHours, deadOrTravelHours, activeDaysCount };
  }, [filteredAppointments]);

  // 4. CÁLCULO DE CLIENTES (Totales vs Nuevos)
  const clientStats = useMemo(() => {
    const totalClients = clients.length;

    // Clientes creados en el rango
    const newClients = clients.filter((c) => {
      if (!c.createdAt) return false;
      let createdDate = '';
      if (typeof c.createdAt.toDate === 'function') {
        createdDate = c.createdAt.toDate().toISOString().split('T')[0];
      } else if (c.createdAt instanceof Date) {
        createdDate = c.createdAt.toISOString().split('T')[0];
      } else if (typeof c.createdAt === 'string') {
        createdDate = c.createdAt.split('T')[0];
      }
      return createdDate >= dateRange.start && createdDate <= dateRange.end;
    }).length;

    return { totalClients, newClients };
  }, [clients, dateRange]);

  // 5. CÁLCULO DE MAQUINARIA E INVENTARIO
  const inventoryStats = useMemo(() => {
    let machineryList: any[] = [];
    let lowStockList: any[] = [];

    inventory.forEach((item) => {
      // Filtrar por equipo
      const matchTeam = selectedTeam === 'Todos' ? true : (item.team || 'Oficina/General') === selectedTeam;
      if (!matchTeam) return;

      if (item.category === 'maquinaria') {
        machineryList.push(item);
      } else if (item.stock !== undefined) {
        const threshold = item.minStockAlert !== undefined ? item.minStockAlert : 2;
        if (item.stock <= threshold) {
          lowStockList.push(item);
        }
      }
    });

    machineryList.sort((a, b) => (b.totalHours || 0) - (a.totalHours || 0));
    lowStockList.sort((a, b) => (a.stock || 0) - (b.stock || 0));

    return { machineryList, lowStockList };
  }, [inventory, selectedTeam]);

  const activeTeamsList = ['Todos', 'Oficina/General', ...(teams.length > 0 ? teams.map(t => t.name) : ['Equipo 1', 'Equipo 2'])];

  const saveAdminConfig = async () => {
    try {
      const { doc, setDoc } = require('firebase/firestore');
      await setDoc(doc(db, 'config', 'admin'), {
        pinEnabled: editingPinEnabled,
        pin: editingPin
      });
      alert('✅ Configuración de seguridad guardada.');
    } catch (error) {
      console.error(error);
      alert('Error al guardar la configuración.');
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.mainTitle}>📊 Dashboard Ejecutivo Avalon Mystic</Text>

      {/* FILTROS GLOBALES DE PERIODO */}
      <View style={styles.filtersCard}>
        <Text style={styles.filterTitle}>1. Periodo temporal:</Text>
        <View style={styles.timeButtonsRow}>
          {(['dia', 'semana', 'mes', 'rango'] as TimeFilter[]).map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[styles.timeBtn, timeFilter === filter && styles.timeBtnActive]}
              onPress={() => setTimeFilter(filter)}
            >
              <Text style={timeFilter === filter ? styles.timeBtnTextActive : styles.timeBtnTextInactive}>
                {filter === 'dia' ? '📅 Día' : filter === 'semana' ? '📆 Esta Semana' : filter === 'mes' ? '🗓️ Este Mes' : '⏳ Rango'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {timeFilter === 'dia' && (
          <View style={styles.dateInputContainer}>
            <Text style={styles.dateInputLabel}>Fecha seleccionada (AAAA-MM-DD):</Text>
            <TextInput
              style={styles.dateInput}
              value={selectedDay}
              onChangeText={setSelectedDay}
              placeholder="2026-09-16"
            />
          </View>
        )}

        {timeFilter === 'rango' && (
          <View style={styles.rangeInputsRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.dateInputLabel}>Desde:</Text>
              <TextInput
                style={styles.dateInput}
                value={customStartDate}
                onChangeText={setCustomStartDate}
                placeholder="AAAA-MM-DD"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.dateInputLabel}>Hasta:</Text>
              <TextInput
                style={styles.dateInput}
                value={customEndDate}
                onChangeText={setCustomEndDate}
                placeholder="AAAA-MM-DD"
              />
            </View>
          </View>
        )}

        <Text style={[styles.filterTitle, { marginTop: 12 }]}>2. Filtrar por Equipo:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.teamScrollRow}>
          {activeTeamsList.map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.teamChip, selectedTeam === t && styles.teamChipActive]}
              onPress={() => setSelectedTeam(t)}
            >
              <Text style={selectedTeam === t ? styles.teamChipTextActive : styles.teamChipTextInactive}>
                {t === 'Todos' ? '🌐 Todos los Equipos' : t === 'Oficina/General' ? '🏢 General' : `🚐 ${t}`}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.rangeNotice}>
          Mostrando datos del <Text style={{ fontWeight: 'bold' }}>{dateRange.start}</Text> al <Text style={{ fontWeight: 'bold' }}>{dateRange.end}</Text>
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#4a9b40" style={{ marginVertical: 30 }} />
      ) : (
        <View style={styles.dashboardGrid}>
          {/* SECCIÓN 1: FINANZAS */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>1. 💶 Finanzas: Ingresos vs Gastos</Text>
            </View>

            <View style={styles.kpiRow}>
              <View style={[styles.kpiBox, { backgroundColor: '#eaf5ea', borderColor: '#b2dfb2' }]}>
                <Text style={styles.kpiLabel}>Ingresos Brutos</Text>
                <Text style={[styles.kpiValue, { color: '#256320' }]}>+ {billingStats.totalIncome.toLocaleString()} €</Text>
                <Text style={styles.kpiSub}>Facturado</Text>
              </View>
              <View style={[styles.kpiBox, { backgroundColor: '#ffe5e5', borderColor: '#ffcccc' }]}>
                <Text style={styles.kpiLabel}>Gastos Totales</Text>
                <Text style={[styles.kpiValue, { color: '#d9534f' }]}>- {billingStats.totalExpenses.toLocaleString()} €</Text>
                <Text style={styles.kpiSub}>Operativos</Text>
              </View>
            </View>
            <View style={[styles.kpiBox, { backgroundColor: '#eef4fa', borderColor: '#cfe0f2', marginBottom: 15 }]}>
              <Text style={styles.kpiLabel}>Beneficio Neto</Text>
              <Text style={[styles.kpiValue, { color: '#002a54', fontSize: 28 }]}>{billingStats.netProfit.toLocaleString()} €</Text>
              <Text style={styles.kpiSub}>Ganancia real de la empresa</Text>
            </View>

            <Text style={styles.subSectionTitle}>Ingresos por Equipos:</Text>
            {Object.keys(billingStats.byTeam).length > 0 ? (
              Object.entries(billingStats.byTeam).map(([tName, amount]) => (
                <View key={tName} style={styles.breakdownRow}>
                  <Text style={styles.breakdownName}>🚐 {tName}</Text>
                  <Text style={styles.breakdownAmount}>{amount} €</Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>Sin facturación registrada en este periodo.</Text>
            )}
          </View>

          {/* SECCIÓN 2: RENDIMIENTO POR SERVICIO */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>2. 🧹 Rendimiento por Servicio</Text>
            </View>

            <View style={styles.kpiRow}>
              <View style={[styles.kpiBox, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
                <Text style={styles.kpiLabel}>Facturación</Text>
                <Text style={[styles.kpiValue, { color: '#166534' }]}>{servicesStats.totalBilling.toLocaleString()} €</Text>
                <Text style={styles.kpiSub}>Total servicios</Text>
              </View>
              <View style={[styles.kpiBox, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
                <Text style={styles.kpiLabel}>Ticket Medio</Text>
                <Text style={[styles.kpiValue, { color: '#166534' }]}>{servicesStats.averageTicket} €</Text>
                <Text style={styles.kpiSub}>Por servicio</Text>
              </View>
            </View>
            <View style={styles.kpiRow}>
              <View style={[styles.kpiBox, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}>
                <Text style={styles.kpiLabel}>Duración Total</Text>
                <Text style={[styles.kpiValue, { color: '#1e3a8a' }]}>{(servicesStats.totalDurationMins / 60).toFixed(1)} h</Text>
                <Text style={styles.kpiSub}>Horas trabajadas</Text>
              </View>
              <View style={[styles.kpiBox, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}>
                <Text style={styles.kpiLabel}>Duración Media</Text>
                <Text style={[styles.kpiValue, { color: '#1e3a8a' }]}>{servicesStats.averageDurationMins} m</Text>
                <Text style={styles.kpiSub}>Por servicio</Text>
              </View>
            </View>

            <Text style={styles.subSectionTitle}>Top Servicios Más Contratados:</Text>
            {servicesStats.topServices.length > 0 ? (
              servicesStats.topServices.map((srv, idx) => (
                <View key={srv.name} style={styles.serviceItem}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={styles.serviceItemName}>#{idx + 1} {srv.name}</Text>
                    <Text style={styles.serviceItemCount}>{srv.count}</Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${Math.min(100, (srv.count / (servicesStats.totalCount || 1)) * 100)}%`
                        }
                      ]}
                    />
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>No hay servicios en este rango de fechas.</Text>
            )}
          </View>

          {/* SECCIÓN 3: EFICIENCIA DE HORARIO */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>3. ⏱️ Eficiencia de Horario y Rutas</Text>
            </View>

            <View style={styles.efficiencyMainBox}>
              <Text style={styles.efficiencyPct}>{efficiencyStats.efficiencyPct}%</Text>
              <Text style={styles.efficiencyLabel}>Ocupación Activa</Text>
              <Text style={styles.efficiencySub}>
                (Horas limpiando frente a la jornada total)
              </Text>
            </View>

            <View style={styles.kpiRow}>
              <View style={[styles.kpiBox, { backgroundColor: '#eaf5ea', borderColor: '#b2dfb2' }]}>
                <Text style={styles.kpiLabel}>En Limpiezas</Text>
                <Text style={[styles.kpiValue, { color: '#256320' }]}>{efficiencyStats.serviceHours} h</Text>
                <Text style={styles.kpiSub}>Trabajo facturable</Text>
              </View>
              <View style={[styles.kpiBox, { backgroundColor: '#fff3e0', borderColor: '#ffe0b2' }]}>
                <Text style={styles.kpiLabel}>De Viaje</Text>
                <Text style={[styles.kpiValue, { color: '#e65100' }]}>{efficiencyStats.deadOrTravelHours} h</Text>
                <Text style={styles.kpiSub}>Conducción</Text>
              </View>
            </View>
          </View>

          {/* SECCIÓN 4: ANÁLISIS DE CLIENTES */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>4. 👥 Cartera y Adquisición de Clientes</Text>
            </View>

            <View style={styles.kpiRow}>
              <View style={[styles.kpiBox, { backgroundColor: '#eef4fa', borderColor: '#cfe0f2' }]}>
                <Text style={styles.kpiLabel}>Cartera Total</Text>
                <Text style={[styles.kpiValue, { color: '#002a54' }]}>{clientStats.totalClients}</Text>
                <Text style={styles.kpiSub}>Histórico</Text>
              </View>
              <View style={[styles.kpiBox, { backgroundColor: '#eaf5ea', borderColor: '#b2dfb2' }]}>
                <Text style={styles.kpiLabel}>Nuevos Clientes</Text>
                <Text style={[styles.kpiValue, { color: '#256320' }]}>+{clientStats.newClients}</Text>
                <Text style={styles.kpiSub}>En el periodo</Text>
              </View>
            </View>
          </View>

          {/* SECCIÓN 5: DESGASTE DE MAQUINARIA */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>5. 🚜 Control de Maquinaria</Text>
            </View>
            <Text style={styles.subSectionTitle}>Horas de uso acumuladas:</Text>
            {inventoryStats.machineryList.length > 0 ? (
              inventoryStats.machineryList.map((mac) => (
                <View key={mac.id} style={styles.breakdownRow}>
                  <View>
                    <Text style={styles.breakdownName}>{mac.name}</Text>
                    <Text style={{fontSize: 11, color: '#777'}}>{mac.team === 'Oficina/General' ? '🏢 General' : `🚐 ${mac.team}`}</Text>
                  </View>
                  <Text style={[styles.breakdownAmount, {color: '#002a54'}]}>{mac.totalHours || 0} h</Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>No hay maquinaria registrada.</Text>
            )}
          </View>

          {/* SECCIÓN 6: ALERTAS DE STOCK */}
          <View style={[styles.sectionCard, { borderColor: '#f5c6cb' }]}>
            <View style={[styles.sectionHeader, { borderBottomColor: '#f5c6cb' }]}>
              <Text style={[styles.sectionTitle, { color: '#721c24' }]}>6. ⚠️ Alertas de Inventario</Text>
            </View>
            <Text style={[styles.subSectionTitle, { color: '#721c24' }]}>Productos próximos a agotarse:</Text>
            {inventoryStats.lowStockList.length > 0 ? (
              inventoryStats.lowStockList.map((item) => (
                <View key={item.id} style={[styles.breakdownRow, { borderBottomColor: '#fdf3f4' }]}>
                  <View>
                    <Text style={[styles.breakdownName, { color: '#721c24' }]}>{item.name}</Text>
                    <Text style={{fontSize: 11, color: '#d9534f'}}>{item.team === 'Oficina/General' ? '🏢 General' : `🚐 ${item.team}`}</Text>
                  </View>
                  <Text style={[styles.breakdownAmount, { color: '#d9534f', fontSize: 18 }]}>{item.stock || 0} u.</Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>Stock en niveles óptimos. ✅</Text>
            )}
          </View>

          {/* SECCIÓN 7: CONFIGURACIÓN DE SEGURIDAD */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>7. ⚙️ Seguridad y Acceso</Text>
            </View>
            <View style={{ gap: 15, paddingVertical: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.kpiLabel}>Requerir PIN para Administrador</Text>
                <TouchableOpacity 
                  style={[styles.toggleBtn, editingPinEnabled ? styles.toggleOn : styles.toggleOff]} 
                  onPress={() => setEditingPinEnabled(!editingPinEnabled)}
                >
                  <Text style={styles.toggleText}>{editingPinEnabled ? 'ACTIVADO' : 'DESACTIVADO'}</Text>
                </TouchableOpacity>
              </View>

              {editingPinEnabled && (
                <View style={{ marginTop: 10 }}>
                  <Text style={styles.dateInputLabel}>Nuevo PIN (4 dígitos):</Text>
                  <TextInput
                    style={styles.dateInput}
                    keyboardType="numeric"
                    maxLength={4}
                    value={editingPin}
                    onChangeText={setEditingPin}
                  />
                </View>
              )}

              <TouchableOpacity style={styles.saveBtn} onPress={saveAdminConfig}>
                <Text style={styles.saveBtnText}>Guardar Configuración</Text>
              </TouchableOpacity>
            </View>
          </View>

        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 15, backgroundColor: '#f0f4f8' },
  mainTitle: { fontSize: 22, fontWeight: 'bold', color: '#002a54', marginBottom: 15 },
  
  // Tarjeta de Filtros
  filtersCard: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#dbe2ea',
    elevation: 2
  },
  filterTitle: { fontSize: 13, fontWeight: 'bold', color: '#002a54', marginBottom: 8 },
  timeButtonsRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  timeBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f9f9f9'
  },
  timeBtnActive: { backgroundColor: '#002a54', borderColor: '#002a54' },
  timeBtnTextActive: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 },
  timeBtnTextInactive: { color: '#444', fontWeight: 'bold', fontSize: 13 },
  dateInputContainer: { marginTop: 10 },
  dateInputLabel: { fontSize: 12, color: '#666', marginBottom: 4 },
  dateInput: {
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13
  },
  rangeInputsRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  teamScrollRow: { marginTop: 4, marginBottom: 8 },
  teamChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f9f9f9',
    marginRight: 8
  },
  teamChipActive: { backgroundColor: '#4a9b40', borderColor: '#4a9b40' },
  teamChipTextActive: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  teamChipTextInactive: { color: '#333', fontSize: 12 },
  rangeNotice: { fontSize: 12, color: '#666', fontStyle: 'italic', marginTop: 4 },

  // Grid
  dashboardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
    justifyContent: 'space-between'
  },

  // Secciones
  sectionCard: {
    flex: 1,
    minWidth: 320,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 0,
    borderWidth: 1,
    borderColor: '#dbe2ea',
    elevation: 2
  },
  sectionHeader: { marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#002a54' },
  subSectionTitle: { fontSize: 13, fontWeight: 'bold', color: '#002a54', marginTop: 12, marginBottom: 8 },

  // KPIs
  kpiRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  kpiBox: { flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, alignItems: 'center' },
  kpiLabel: { fontSize: 12, fontWeight: 'bold', color: '#555', marginBottom: 2 },
  kpiValue: { fontSize: 22, fontWeight: 'bold', marginBottom: 2 },
  kpiSub: { fontSize: 11, color: '#777', textAlign: 'center' },

  // Desglose
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0'
  },
  breakdownName: { fontSize: 14, fontWeight: 'bold', color: '#333' },
  breakdownAmount: { fontSize: 14, fontWeight: 'bold', color: '#4a9b40' },

  // Top Servicios
  serviceItem: { marginBottom: 10 },
  serviceItemName: { fontSize: 13, fontWeight: 'bold', color: '#002a54' },
  serviceItemCount: { fontSize: 12, color: '#666', fontWeight: 'bold' },
  progressBarBg: { height: 8, backgroundColor: '#eee', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#4a9b40', borderRadius: 4 },

  // Eficiencia
  efficiencyMainBox: {
    backgroundColor: '#f7faf8',
    borderWidth: 1,
    borderColor: '#cce5cc',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginBottom: 12
  },
  efficiencyPct: { fontSize: 36, fontWeight: 'bold', color: '#256320', marginBottom: 4 },
  efficiencyLabel: { fontSize: 14, fontWeight: 'bold', color: '#002a54' },
  efficiencySub: { fontSize: 11, color: '#666', textAlign: 'center', marginTop: 4 },

  emptyText: { color: '#888', fontStyle: 'italic', fontSize: 13, textAlign: 'center', marginVertical: 10 },
  toggleBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15, borderWidth: 1 },
  toggleOn: { backgroundColor: '#eaf5ea', borderColor: '#4a9b40' },
  toggleOff: { backgroundColor: '#ffe5e5', borderColor: '#d9534f' },
  toggleText: { fontSize: 12, fontWeight: 'bold', color: '#333' },
  saveBtn: { backgroundColor: '#002a54', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 }
});
