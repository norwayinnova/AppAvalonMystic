import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';

interface RouteSegment {
  fromIndex: number;
  toIndex: number;
  distanceKm: number;
  durationMins: number;
}

export default function RouteScreen() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [showCalendar, setShowCalendar] = useState(false);
  const [filterTeam, setFilterTeam] = useState('Equipo 1');

  // Estado del cálculo de ruta y kilómetros
  const [totalKm, setTotalKm] = useState<number | null>(null);
  const [totalDrivingMinutes, setTotalDrivingMinutes] = useState<number | null>(null);
  const [segments, setSegments] = useState<RouteSegment[]>([]);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);

  // 1. Cargar equipos dinámicos
  useEffect(() => {
    const qTeams = query(collection(db, 'teams'));
    const unsubscribeTeams = onSnapshot(qTeams, (snapshot) => {
      const teamsList: any[] = [];
      snapshot.forEach(docSnap => teamsList.push({ id: docSnap.id, ...docSnap.data() }));
      teamsList.sort((a, b) => a.name.localeCompare(b.name));
      setTeams(teamsList);
      if (teamsList.length > 0 && (!filterTeam || filterTeam === 'Todos')) {
        setFilterTeam(teamsList[0].name);
      }
    });
    return () => unsubscribeTeams();
  }, []);

  // 2. Cargar citas del día seleccionado
  useEffect(() => {
    const q = query(collection(db, 'appointments'), where('date', '==', selectedDate));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const appsList: any[] = [];
      snapshot.forEach(doc => appsList.push({ id: doc.id, ...doc.data() }));
      appsList.sort((a, b) => a.time.localeCompare(b.time));
      setAppointments(appsList);
    });
    return () => unsubscribe();
  }, [selectedDate]);

  // Filtrar citas según el equipo seleccionado
  const teamAppointments = useMemo(() => {
    return appointments.filter(app => (app.team || 'Equipo 1') === filterTeam);
  }, [appointments, filterTeam]);

  // 3. CÁLCULO DE KILÓMETROS Y TIEMPOS REALES EN CARRETERA (OSRM + Photon)
  useEffect(() => {
    let isMounted = true;

    async function calculateDrivingRoute() {
      if (teamAppointments.length < 2) {
        setTotalKm(0);
        setTotalDrivingMinutes(0);
        setSegments([]);
        return;
      }

      setIsCalculatingRoute(true);
      try {
        // Geocodificar cada dirección para obtener latitud y longitud
        const coords: { lat: number; lon: number }[] = [];

        for (const app of teamAppointments) {
          if (!app.address || app.address.trim().length < 3) continue;

          try {
            const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(app.address)}&limit=1&lat=40.4168&lon=-3.7038`;
            const res = await fetch(url);
            const data = await res.json();
            if (data?.features?.[0]?.geometry?.coordinates) {
              const [lon, lat] = data.features[0].geometry.coordinates;
              coords.push({ lat, lon });
            }
          } catch (e) {
            console.log('Error geocodificando parada:', e);
          }
        }

        if (coords.length >= 2 && isMounted) {
          // Consultar el motor de rutas en carretera (OSRM Routing Machine)
          const coordsParam = coords.map(c => `${c.lon},${c.lat}`).join(';');
          const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordsParam}?overview=false&steps=false`;
          
          const osrmRes = await fetch(osrmUrl);
          const osrmData = await osrmRes.json();

          if (osrmData?.routes?.[0]) {
            const route = osrmData.routes[0];
            const km = Math.round((route.distance / 1000) * 10) / 10;
            const mins = Math.round(route.duration / 60);

            const segmentList: RouteSegment[] = [];
            if (Array.isArray(route.legs)) {
              route.legs.forEach((leg: any, idx: number) => {
                segmentList.push({
                  fromIndex: idx,
                  toIndex: idx + 1,
                  distanceKm: Math.round((leg.distance / 1000) * 10) / 10,
                  durationMins: Math.round(leg.duration / 60)
                });
              });
            }

            if (isMounted) {
              setTotalKm(km);
              setTotalDrivingMinutes(mins);
              setSegments(segmentList);
            }
          }
        } else if (isMounted) {
          // Si no hay suficientes coordenadas exactas
          setTotalKm(0);
          setTotalDrivingMinutes(0);
          setSegments([]);
        }
      } catch (error) {
        console.log('Error calculando ruta:', error);
      } finally {
        if (isMounted) setIsCalculatingRoute(false);
      }
    }

    calculateDrivingRoute();

    return () => {
      isMounted = false;
    };
  }, [teamAppointments]);

  const openFullRoute = () => {
    const addresses = teamAppointments.map(app => app.address).filter(addr => addr && addr.trim() !== '');
    if (addresses.length === 0) {
      alert(`No hay direcciones registradas para el ${filterTeam} este día.`);
      return;
    }
    
    const baseUrl = "https://www.google.com/maps/dir/";
    const encodedAddresses = addresses.map(addr => encodeURIComponent(addr)).join('/');
    Linking.openURL(baseUrl + encodedAddresses).catch(() => alert("No se pudo abrir el mapa."));
  };

  const callClient = (phone: string | undefined) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`);
  };

  const teamOptions = teams.length > 0 ? teams.map(t => t.name) : ['Equipo 1', 'Equipo 2'];

  // URL del mapa satélite/callejero interactivo
  const mapEmbedUrl = useMemo(() => {
    const addresses = teamAppointments.map(app => app.address).filter(Boolean);
    if (addresses.length === 0) return null;
    const q = addresses.map(a => encodeURIComponent(a)).join(' / ');
    return `https://maps.google.com/maps?q=${encodeURIComponent(addresses[0])}&t=&z=12&ie=UTF8&iwloc=&output=embed`;
  }, [teamAppointments]);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>🗺️ Planificador y Rutas del Día</Text>

      {/* Selector de Fecha */}
      <TouchableOpacity style={styles.dropdownBtn} onPress={() => setShowCalendar(!showCalendar)}>
        <Text style={styles.dropdownText}>📅 Fecha: {selectedDate} {showCalendar ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      
      {showCalendar && (
        <View style={styles.calendarContainer}>
          <Calendar
            onDayPress={(day: any) => { setSelectedDate(day.dateString); setShowCalendar(false); }}
            markedDates={{ [selectedDate]: { selected: true, selectedColor: '#4a9b40' } }}
            theme={{ todayTextColor: '#002a54', arrowColor: '#002a54' }}
          />
        </View>
      )}

      {/* Selector de Equipo */}
      <Text style={styles.sectionLabel}>Seleccionar Equipo / Furgoneta:</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.teamFilterRow}>
        {teamOptions.map(t => (
          <TouchableOpacity 
            key={t} 
            style={[styles.teamFilterBtn, filterTeam === t && styles.teamFilterBtnSelected]}
            onPress={() => setFilterTeam(t)}
          >
            <Text style={filterTeam === t ? styles.teamFilterTextSelected : styles.teamFilterTextUnselected}>
              🚐 {t}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* PANEL DE CONTROL DE KILÓMETROS Y TIEMPO DE CARRETERA */}
      <View style={styles.kpiCard}>
        <View style={styles.kpiRow}>
          <View style={[styles.kpiBox, { backgroundColor: '#eaf5ea', borderColor: '#b2dfb2' }]}>
            <Text style={styles.kpiLabel}>Distancia en Ruta</Text>
            {isCalculatingRoute ? (
              <ActivityIndicator size="small" color="#256320" style={{ marginVertical: 4 }} />
            ) : (
              <Text style={[styles.kpiValue, { color: '#256320' }]}>
                {totalKm !== null ? `${totalKm} km` : '--'}
              </Text>
            )}
            <Text style={styles.kpiSub}>Entre todos los servicios</Text>
          </View>

          <View style={[styles.kpiBox, { backgroundColor: '#eef4fa', borderColor: '#cfe0f2' }]}>
            <Text style={styles.kpiLabel}>Tiempo al Volante</Text>
            {isCalculatingRoute ? (
              <ActivityIndicator size="small" color="#002a54" style={{ marginVertical: 4 }} />
            ) : (
              <Text style={[styles.kpiValue, { color: '#002a54' }]}>
                {totalDrivingMinutes !== null ? `${totalDrivingMinutes} min` : '--'}
              </Text>
            )}
            <Text style={styles.kpiSub}>Conducción estimada</Text>
          </View>

          <View style={[styles.kpiBox, { backgroundColor: '#fff8e7', borderColor: '#fae4b2' }]}>
            <Text style={styles.kpiLabel}>Paradas Totales</Text>
            <Text style={[styles.kpiValue, { color: '#8a5800' }]}>{teamAppointments.length}</Text>
            <Text style={styles.kpiSub}>Clientes a visitar</Text>
          </View>
        </View>
      </View>

      {/* VISTA DEL MAPA EMBEBIDO EN LA PANTALLA */}
      {teamAppointments.length > 0 && mapEmbedUrl && (
        <View style={styles.mapContainer}>
          <View style={styles.mapHeader}>
            <Text style={styles.mapTitle}>📍 Mapa de Ubicaciones del {filterTeam}</Text>
          </View>
          <iframe
            title="Mapa de Rutas"
            src={mapEmbedUrl}
            style={{ width: '100%', height: 260, border: 0 }}
            loading="lazy"
          />
        </View>
      )}

      {/* LISTA SECUENCIAL DE PARADAS Y DESPLAZAMIENTOS */}
      <Text style={styles.sectionLabel}>Itinerario del Día ({teamAppointments.length} paradas):</Text>
      {teamAppointments.length > 0 ? (
        <View style={{ marginBottom: 20 }}>
          {teamAppointments.map((item, index) => {
            const segment = segments.find(s => s.fromIndex === index);

            return (
              <View key={item.id}>
                {/* Tarjeta de la parada */}
                <View style={styles.routeCard}>
                  <View style={styles.numberCircle}>
                    <Text style={styles.numberText}>{index + 1}</Text>
                  </View>
                  <View style={styles.routeInfo}>
                    <View style={styles.clientHeader}>
                      <Text style={styles.time}>{item.time} · {item.client}</Text>
                      {item.phone ? (
                        <TouchableOpacity style={styles.phoneBadge} onPress={() => callClient(item.phone)}>
                          <Text style={styles.phoneText}>📞 {item.phone}</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                    <Text style={styles.serviceName}>✨ {item.serviceName} (⏱ {item.duration}m)</Text>
                    <Text style={styles.address}>📍 {item.address || 'Sin dirección'}</Text>
                    {item.detailedInfo ? (
                      <Text style={styles.detailedInfo}>🏢 {item.detailedInfo}</Text>
                    ) : null}
                  </View>
                </View>

                {/* Conector de desplazamiento entre paradas */}
                {index < teamAppointments.length - 1 && (
                  <View style={styles.travelConnector}>
                    <Text style={styles.travelIcon}>🚗 ⬇️</Text>
                    <Text style={styles.travelText}>
                      Desplazamiento a parada #{index + 2}:{' '}
                      <Text style={{ fontWeight: 'bold', color: '#002a54' }}>
                        {segment ? `${segment.distanceKm} km (${segment.durationMins} min)` : 'Calculando trayecto...'}
                      </Text>
                    </Text>
                  </View>
                )}
              </View>
            );
          })}

          {/* Botón de apertura directa en Google Maps */}
          <TouchableOpacity style={styles.mapButton} onPress={openFullRoute}>
            <Text style={styles.mapButtonText}>
              🗺️ Abrir Navegación Turn-by-Turn en Google Maps
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            No hay servicios asignados para el {filterTeam} en la fecha seleccionada ({selectedDate}).
          </Text>
        </View>
      )}

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 15, backgroundColor: '#f0f4f8' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 15, color: '#002a54' },
  sectionLabel: { fontSize: 14, fontWeight: 'bold', color: '#002a54', marginBottom: 8 },
  
  dropdownBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', padding: 14, borderRadius: 8, marginBottom: 12, alignItems: 'center' },
  dropdownText: { color: '#002a54', fontWeight: 'bold', fontSize: 16 },
  calendarContainer: { borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#ddd', marginBottom: 15 },
  
  teamFilterRow: { flexGrow: 0, marginBottom: 15, height: 45 },
  teamFilterBtn: { paddingVertical: 8, paddingHorizontal: 15, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 20, marginRight: 10, justifyContent: 'center' },
  teamFilterBtnSelected: { backgroundColor: '#002a54', borderColor: '#002a54' },
  teamFilterTextSelected: { color: '#fff', fontWeight: 'bold' },
  teamFilterTextUnselected: { color: '#333' },

  // Tarjeta de KPIs de Kilometraje
  kpiCard: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#dbe2ea',
    elevation: 2
  },
  kpiRow: { flexDirection: 'row', gap: 8 },
  kpiBox: { flex: 1, padding: 10, borderRadius: 8, borderWidth: 1, alignItems: 'center' },
  kpiLabel: { fontSize: 11, fontWeight: 'bold', color: '#555', marginBottom: 2 },
  kpiValue: { fontSize: 18, fontWeight: 'bold', marginBottom: 2 },
  kpiSub: { fontSize: 10, color: '#777', textAlign: 'center' },

  // Mapa embebido
  mapContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#dbe2ea',
    elevation: 2
  },
  mapHeader: { backgroundColor: '#002a54', paddingHorizontal: 12, paddingVertical: 8 },
  mapTitle: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 },

  // Itinerario
  routeCard: { flexDirection: 'row', backgroundColor: '#fff', padding: 14, borderRadius: 8, alignItems: 'center', elevation: 1, borderWidth: 1, borderColor: '#dbe2ea' },
  numberCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#002a54', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  numberText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  routeInfo: { flex: 1 },
  clientHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 2 },
  time: { fontWeight: 'bold', color: '#002a54', fontSize: 15 },
  phoneBadge: { backgroundColor: '#eef7ee', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: '#c5e6c5' },
  phoneText: { color: '#256320', fontWeight: 'bold', fontSize: 11 },
  serviceName: { color: '#4a9b40', fontWeight: 'bold', fontSize: 13, marginBottom: 3 },
  address: { color: '#444', fontSize: 13, marginBottom: 2 },
  detailedInfo: { color: '#8a5800', fontWeight: 'bold', fontSize: 11, backgroundColor: '#fff8e7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start' },

  // Desplazamiento entre paradas
  travelConnector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 15,
    backgroundColor: '#f1f6fb',
    marginHorizontal: 20,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#002a54',
    marginVertical: 4
  },
  travelIcon: { fontSize: 13, marginRight: 8 },
  travelText: { fontSize: 12, color: '#444' },

  mapButton: { backgroundColor: '#4a9b40', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 15 },
  mapButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  emptyCard: { backgroundColor: '#fff', padding: 25, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#ddd' },
  emptyText: { textAlign: 'center', color: '#888', fontStyle: 'italic', fontSize: 14 }
});
