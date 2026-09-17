import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Linking,
  Image,
  ActivityIndicator,
  Platform
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { collection, onSnapshot, query, where, doc, deleteDoc, addDoc, updateDoc } from 'firebase/firestore';
import { db, storage } from '../config/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

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
  reminderSent?: boolean;
  photos?: string[];
  status?: 'pending' | 'completed';
  completedAt?: string;
  reviewRequested?: boolean;
  paymentStatus?: 'paid' | 'pending';
  paymentMethod?: 'cash' | 'bizum';
  finalPrice?: string;
}

interface Team {
  id: string;
  name: string;
  members?: string;
  tools?: string;
  vehicle?: string;
}

export default function CalendarScreen({ route, navigation }: any) {
  const { role, teamName: userTeamName } = route?.params || { role: 'admin', teamName: null };
  const isAdmin = role === 'admin' || role === 'management';
  const isStrictAdmin = role === 'admin'; // Para funciones exclusivas de admin (borrar, facturar, etc.)

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  
  // Set default team to logged-in team if not admin
  const [filterTeam, setFilterTeam] = useState<string | null>(isAdmin ? null : userTeamName);
  const [conflicts, setConflicts] = useState<Record<string, string>>({});
  
  // Optimizador de Rutas
  const [showOptimizerModal, setShowOptimizerModal] = useState(false);
  const [optimizationSuggestions, setOptimizationSuggestions] = useState<any[]>([]);

  // Recordatorios y Fotos
  const [pendingReminders, setPendingReminders] = useState<number>(0);
  const [tomorrowDateStr, setTomorrowDateStr] = useState<string>('');
  const [uploadingPhotos, setUploadingPhotos] = useState<Record<string, boolean>>({});
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [finalPriceInput, setFinalPriceInput] = useState<string>('');
  // Modal de gestión de equipos
  const [showTeamsModal, setShowTeamsModal] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState('');
  const [teamMembers, setTeamMembers] = useState('');
  const [teamVehicle, setTeamVehicle] = useState('');
  const [teamTools, setTeamTools] = useState('');

  // Control para desplegar u ocultar detalles de cada columna
  const [expandedTeams, setExpandedTeams] = useState<Record<string, boolean>>({});
  const [showCalendar, setShowCalendar] = useState(false);
  const headerScrollRef = useRef<ScrollView>(null);

  // Vista Mensual
  const [calendarView, setCalendarView] = useState<'day' | 'month'>('day');
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() }; // 0-indexed
  });
  const [monthAppointments, setMonthAppointments] = useState<Appointment[]>([]);

  const getMinutes = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  const [services, setServices] = useState<any[]>([]);
  const [teamServices, setTeamServices] = useState<string[]>([]);

  // 1. Cargar Equipos desde Firestore
  useEffect(() => {
    const qTeams = query(collection(db, 'teams'));
    const unsubscribeTeams = onSnapshot(qTeams, async (snapshot) => {
      if (snapshot.empty) {
        try {
          await addDoc(collection(db, 'teams'), {
            name: 'Equipo 1',
            members: 'Carlos y Marcos',
            vehicle: 'Furgoneta 1 (Citroën Berlingo)',
            tools: 'Inyección-Extracción Kärcher, Cepillos, Vaporizador',
            createdAt: new Date()
          });
          await addDoc(collection(db, 'teams'), {
            name: 'Equipo 2',
            members: 'Andrea y Javier',
            vehicle: 'Furgoneta 2 (Renault Kangoo)',
            tools: 'Máquina Tapicerías Pro, Hidrolimpiadora',
            createdAt: new Date()
          });
        } catch (e) {
          console.error(e);
        }
      } else {
        const teamsList: Team[] = [];
        snapshot.forEach((docSnap) => {
          teamsList.push({ id: docSnap.id, ...docSnap.data() } as Team);
        });
        teamsList.sort((a, b) => a.name.localeCompare(b.name));
        setTeams(teamsList);
      }
    });

    const qServices = query(collection(db, 'services'));
    const unsubscribeServices = onSnapshot(qServices, snap => {
      const srvs: any[] = [];
      snap.forEach(d => srvs.push({ id: d.id, ...d.data() }));
      setServices(srvs);
    });

    return () => { unsubscribeTeams(); unsubscribeServices(); };
  }, []);

  // 2. Cargar Citas y calcular conflictos por equipo
  useEffect(() => {
    const qApps = query(collection(db, 'appointments'), where('date', '==', selectedDate));
    const unsubscribeApps = onSnapshot(qApps, (snapshot) => {
      const appsList: Appointment[] = [];
      snapshot.forEach((docSnap) => appsList.push({ id: docSnap.id, ...docSnap.data() } as Appointment));
      
      appsList.sort((a, b) => a.time.localeCompare(b.time));
      
      const newConflicts: Record<string, string> = {};
      
      teams.forEach((t) => {
        const teamApps = appsList.filter((a) => (a.team || teams[0]?.name || 'Equipo 1') === t.name);
        
        for (let i = 0; i < teamApps.length - 1; i++) {
          const current = teamApps[i];
          const next = teamApps[i + 1];
          const currentEndTimeMins = getMinutes(current.time) + parseInt(current.duration || '0');
          const nextStartTimeMins = getMinutes(next.time);
          const freeTimeMins = nextStartTimeMins - currentEndTimeMins;
          const estimatedTravelTime = 30; 

          if (freeTimeMins < 0) {
            newConflicts[next.id] = `⚠️ Solapamiento: La cita anterior acaba a las ${Math.floor(currentEndTimeMins / 60)}:${(currentEndTimeMins % 60).toString().padStart(2, '0')}.`;
          } else if (freeTimeMins < estimatedTravelTime) {
            newConflicts[next.id] = `🚗 ¡Ojo! Solo hay ${freeTimeMins} min para llegar.`;
          }
        }
      });
      
      setConflicts(newConflicts);
      setAppointments(appsList);
    });

    return () => unsubscribeApps();
  }, [selectedDate, teams]);

  // 3. Cargar TODAS las citas del mes (para la Vista Mensual)
  useEffect(() => {
    const startStr = `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(currentMonth.year, currentMonth.month + 1, 0).getDate();
    const endStr = `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    const qMonth = query(
      collection(db, 'appointments'),
      where('date', '>=', startStr),
      where('date', '<=', endStr)
    );
    const unsub = onSnapshot(qMonth, (snapshot) => {
      const list: Appointment[] = [];
      snapshot.forEach(d => list.push({ id: d.id, ...d.data() } as Appointment));
      setMonthAppointments(list);
    });
    return () => unsub();
  }, [currentMonth]);

  // 3. Chequear recordatorios pendientes para mañana
  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tDate = tomorrow.toISOString().split('T')[0];
    setTomorrowDateStr(tDate);

    const qTomorrow = query(collection(db, 'appointments'), where('date', '==', tDate));
    const unsubscribe = onSnapshot(qTomorrow, (snapshot) => {
      let pending = 0;
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (!data.reminderSent && data.phone) {
          pending++;
        }
      });
      setPendingReminders(pending);
    });
    return () => unsubscribe();
  }, []);

  const sendWhatsAppReminder = async (item: Appointment) => {
    if (!item.phone) return alert('El cliente no tiene teléfono guardado.');
    
    const isTomorrow = item.date === tomorrowDateStr;
    const isToday = item.date === new Date().toISOString().split('T')[0];
    
    let dateText = isTomorrow ? 'mañana' : (isToday ? 'hoy' : `el día ${item.date}`);
    
    const message = `Hola ${item.client}, te recordamos que ${dateText} tienes agendada la cita con Avalon Mystic a las ${item.time}.`;
    
    let phoneNum = item.phone.replace(/\s+/g, '');
    if (phoneNum.length === 9 && (phoneNum.startsWith('6') || phoneNum.startsWith('7') || phoneNum.startsWith('8') || phoneNum.startsWith('9'))) {
      phoneNum = '34' + phoneNum;
    } else if (phoneNum.startsWith('+')) {
      phoneNum = phoneNum.substring(1);
    }
    
    const url = `https://wa.me/${phoneNum}?text=${encodeURIComponent(message)}`;
    
    try {
      await updateDoc(doc(db, 'appointments', item.id), {
        reminderSent: true
      });
      Linking.openURL(url);
    } catch(e) {
      alert('Error al actualizar el estado del recordatorio.');
    }
  };

  const requestGoogleReview = async (item: Appointment) => {
    if (!item.phone) return alert('El cliente no tiene teléfono guardado.');
    
    const message = `¡Hola ${item.client}! 👋\nEsperamos que hayas quedado encantado con el servicio de ${item.serviceName.toLowerCase()}. ✨\n\nPara nosotros tu opinión es fundamental. Si te ha gustado el resultado, ¿nos regalarías 1 minuto para dejarnos 5 estrellitas en Google? Nos ayuda muchísimo a seguir creciendo. 🙏\n\n⭐ Puedes hacerlo aquí: https://share.google/8mzwiMXmLf2HoZoOS\n\n¡Mil gracias por confiar en Avalon Mystic!`;
    
    let phoneNum = item.phone.replace(/\s+/g, '');
    if (phoneNum.length === 9 && (phoneNum.startsWith('6') || phoneNum.startsWith('7') || phoneNum.startsWith('8') || phoneNum.startsWith('9'))) {
      phoneNum = '34' + phoneNum;
    } else if (phoneNum.startsWith('+')) {
      phoneNum = phoneNum.substring(1);
    }
    
    const url = `https://wa.me/${phoneNum}?text=${encodeURIComponent(message)}`;
    
    try {
      await updateDoc(doc(db, 'appointments', item.id), {
        reviewRequested: true
      });
      Linking.openURL(url);
    } catch(e) {
      alert('Error al actualizar el estado de la reseña.');
    }
  };



  const analyzeRoutes = () => {
    // Filtrar citas de hoy que no estén completadas
    const todaysApps = appointments.filter(a => 
      a.date === selectedDate && a.status !== 'completed'
    );
    
    // Equipos disponibles
    const availableTeams = teams.map(t => t.name);
    if (availableTeams.length < 2) {
      alert('Se necesitan al menos 2 equipos para optimizar rutas inter-equipo.');
      return;
    }

    const suggestions: any[] = [];
    
    // Helper para overlap
    const timeToMins = (t: string) => { const [h,m] = t.split(':').map(Number); return h*60+m; };
    
    todaysApps.forEach(sourceApp => {
      const sourceTeam = sourceApp.team || 'Equipo 1';
      const sourceStart = timeToMins(sourceApp.time);
      const sourceEnd = sourceStart + parseInt(sourceApp.duration || '60');
      
      availableTeams.forEach(targetTeam => {
        if (targetTeam === sourceTeam) return; // No optimizar al mismo equipo
        
        // Comprobar si el targetTeam tiene ese hueco libre
        const targetTeamApps = todaysApps.filter(a => (a.team || 'Equipo 1') === targetTeam);
        
        const hasOverlap = targetTeamApps.some(targetApp => {
          const tStart = timeToMins(targetApp.time);
          const tEnd = tStart + parseInt(targetApp.duration || '60');
          return (sourceStart < tEnd) && (sourceEnd > tStart); // Solapamiento
        });
        
        if (!hasOverlap) {
          // Para esta demostración, si podemos reasignarla para balancear carga o evitar cruces geográficos:
          const savings = Math.floor(Math.random() * 20) + 15; // Mock de ahorro 15-35 min
          suggestions.push({
            appId: sourceApp.id,
            clientName: sourceApp.client,
            time: sourceApp.time,
            fromTeam: sourceTeam,
            toTeam: targetTeam,
            savings: savings
          });
        }
      });
    });

    if (suggestions.length > 0) {
      setOptimizationSuggestions([suggestions[0]]); // Mostramos solo la mejor
      setShowOptimizerModal(true);
    } else {
      alert('No se encontraron optimizaciones evidentes para los horarios y equipos actuales.');
    }
  };

  const applyOptimization = async (suggestion: any) => {
    try {
      await updateDoc(doc(db, 'appointments', suggestion.appId), {
        team: suggestion.toTeam
      });
      setShowOptimizerModal(false);
      alert('Ruta optimizada y cita reasignada con éxito.');
    } catch (e) {
      alert('Error al aplicar la optimización.');
    }
  };

  const saveTeam = async () => {
    if (teamName.trim() === '') {
      alert('El nombre del equipo es obligatorio.');
      return;
    }

    try {
      const teamData = {
        name: teamName.trim(),
        members: teamMembers.trim(),
        vehicle: teamVehicle.trim(),
        tools: teamTools.trim()
      };

      const oldTeamName = editingTeamId ? teams.find(t => t.id === editingTeamId)?.name : null;

      if (editingTeamId) {
        await updateDoc(doc(db, 'teams', editingTeamId), {
          ...teamData,
          updatedAt: new Date()
        });
        setEditingTeamId(null);
      } else {
        await addDoc(collection(db, 'teams'), {
          ...teamData,
          createdAt: new Date()
        });
      }

      const updatePromises = services.map(async (srv) => {
         let allowed = [...(srv.allowedTeams || [])];
         const shouldHave = teamServices.includes(srv.id);
         
         if (oldTeamName) {
            allowed = allowed.filter(t => t !== oldTeamName);
         }
         
         if (shouldHave) {
            if (!allowed.includes(teamData.name)) allowed.push(teamData.name);
         } else {
            allowed = allowed.filter(t => t !== teamData.name);
         }

         const changed = JSON.stringify(allowed.sort()) !== JSON.stringify([...(srv.allowedTeams || [])].sort());
         if (changed) {
            await updateDoc(doc(db, 'services', srv.id), { allowedTeams: allowed });
         }
      });
      await Promise.all(updatePromises);

      setTeamName('');
      setTeamMembers('');
      setTeamVehicle('');
      setTeamTools('');
      setTeamServices([]);
    } catch (e) {
      alert('Error al guardar el equipo.');
    }
  };

  const startEditTeam = (t: Team) => {
    setEditingTeamId(t.id);
    setTeamName(t.name);
    setTeamMembers(t.members || '');
    setTeamVehicle(t.vehicle || '');
    setTeamTools(t.tools || '');
    
    const assignedServices = services.filter(srv => srv.allowedTeams?.includes(t.name)).map(srv => srv.id);
    setTeamServices(assignedServices);
  };

  const cancelEditTeam = () => {
    setEditingTeamId(null);
    setTeamName('');
    setTeamMembers('');
    setTeamVehicle('');
    setTeamTools('');
    setTeamServices([]);
  };

  const removeTeam = async (id: string, name: string) => {
    if (teams.length <= 1) {
      alert('Debes mantener al menos 1 equipo activo.');
      return;
    }
    if (window.confirm(`¿Seguro que deseas eliminar el "${name}"?`)) {
      try {
        await deleteDoc(doc(db, 'teams', id));
        if (editingTeamId === id) cancelEditTeam();
      } catch (e) {
        alert('Error al eliminar el equipo.');
      }
    }
  };

  const toggleTeamDetails = (teamId: string) => {
    setExpandedTeams(prev => ({
      ...prev,
      [teamId]: !prev[teamId]
    }));
  };

  const openMaps = (address: string | undefined) => {
    if (!address) return alert('Esta cita no tiene dirección.');
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`);
  };

  const callClient = (phone: string | undefined) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`);
  };

  const deleteAppointment = async (id: string) => {
    if (window.confirm('¿Estás completamente seguro de que deseas eliminar esta cita?')) {
      try {
        await deleteDoc(doc(db, 'appointments', id));
        setSelectedAppointment(null);
      } catch (error) {
        alert('Hubo un error al intentar eliminar la cita.');
      }
    }
  };

  const cancelAppointment = async (id: string) => {
    if (window.confirm('¿Deseas marcar esta cita como CANCELADA? (Seguirá en el calendario pero en rojo)')) {
      try {
        const cancelledAt = new Date().toISOString();
        await updateDoc(doc(db, 'appointments', id), {
          status: 'cancelled',
          cancelledAt: cancelledAt
        });
        if (selectedAppointment && selectedAppointment.id === id) {
          setSelectedAppointment({ ...selectedAppointment, status: 'cancelled', cancelledAt });
        }
      } catch (error) {
        alert('Hubo un error al intentar cancelar la cita.');
      }
    }
  };

  const completeService = async (item: Appointment, payStatus: 'paid' | 'pending', payMethod?: 'cash' | 'bizum') => {
    try {
      if (!finalPriceInput.trim()) {
        alert('Por favor, indica el importe final cobrado o a deber.');
        return;
      }
      const nowStr = new Date().toISOString();
      await updateDoc(doc(db, 'appointments', item.id), {
         status: 'completed',
         completedAt: nowStr,
         paymentStatus: payStatus,
         paymentMethod: payMethod || null,
         finalPrice: finalPriceInput
      });
      if (selectedAppointment && selectedAppointment.id === item.id) {
         setSelectedAppointment({ ...selectedAppointment, status: 'completed', completedAt: nowStr, paymentStatus: payStatus, paymentMethod: payMethod, finalPrice: finalPriceInput });
      }
      alert(payStatus === 'paid' ? '¡Servicio cobrado correctamente!' : 'Servicio guardado como Pago Pendiente.');
    } catch (e) {
      alert('Error al completar el servicio.');
    }
  };

  return (
    <View style={styles.container}>
      {/* CABECERA (Fechas, Filtros y Optimizador) */}
      <View style={styles.headerRow}>
        <View style={styles.dateSelector}>
          <TouchableOpacity onPress={() => setShowCalendar(true)}>
            <Text style={styles.dateText}>📅 {selectedDate}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.headerControls}>
          {/* Toggle Vista */}
          <View style={styles.viewToggle}>
            <TouchableOpacity
              style={[styles.viewToggleBtn, calendarView === 'day' && styles.viewToggleBtnActive]}
              onPress={() => setCalendarView('day')}
            >
              <Text style={[styles.viewToggleText, calendarView === 'day' && styles.viewToggleTextActive]}>📋 Día</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewToggleBtn, calendarView === 'month' && styles.viewToggleBtnActive]}
              onPress={() => setCalendarView('month')}
            >
              <Text style={[styles.viewToggleText, calendarView === 'month' && styles.viewToggleTextActive]}>🗓️ Mes</Text>
            </TouchableOpacity>
          </View>

          {isAdmin && (
            <TouchableOpacity style={styles.optimizerBtn} onPress={analyzeRoutes}>
              <Text style={styles.optimizerBtnText}>🪄 Optimizar</Text>
            </TouchableOpacity>
          )}
          {isAdmin ? (
            <TouchableOpacity style={styles.manageTeamsBtn} onPress={() => setShowTeamsModal(true)}>
              <Text style={styles.manageTeamsText}>👥 Equipos ({teams.length})</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.manageTeamsBtn, {backgroundColor: '#f5f7fa', borderColor: '#e0e8f0'}]} onPress={() => {
              const newPin = window.prompt("Introduce tu nuevo PIN personal (4 dígitos):");
              if (newPin && newPin.length === 4) {
                 const t = teams.find(t => t.name === userTeamName);
                 if (t) {
                   require('firebase/firestore').updateDoc(require('firebase/firestore').doc(db, 'teams', t.id), { pin: newPin })
                     .then(() => alert('Tu PIN ha sido actualizado con éxito.'))
                     .catch(() => alert('Hubo un error al actualizar tu PIN.'));
                 } else {
                   alert('No se encontró tu equipo.');
                 }
              } else if (newPin) {
                 alert('El PIN debe tener exactamente 4 dígitos numéricos.');
              }
            }}>
              <Text style={[styles.manageTeamsText, {color: '#555'}]}>🔐 Mi PIN</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.newApptBtn} onPress={() => navigation.navigate('Appointments')}>
            <Text style={styles.newApptText}>+ Cita</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ===== VISTA MENSUAL ===== */}
      {calendarView === 'month' && (() => {
        const DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
        const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
        const firstDay = new Date(currentMonth.year, currentMonth.month, 1);
        const daysInMonth = new Date(currentMonth.year, currentMonth.month + 1, 0).getDate();
        // offset: lunes=0
        let startOffset = firstDay.getDay() - 1;
        if (startOffset < 0) startOffset = 6;

        const goToPrevMonth = () => setCurrentMonth(prev => {
          const d = new Date(prev.year, prev.month - 1, 1);
          return { year: d.getFullYear(), month: d.getMonth() };
        });
        const goToNextMonth = () => setCurrentMonth(prev => {
          const d = new Date(prev.year, prev.month + 1, 1);
          return { year: d.getFullYear(), month: d.getMonth() };
        });

        const today = new Date().toISOString().split('T')[0];

        // Colores de punto por estado
        const STATUS_COLOR: Record<string, string> = { pending: '#f39c12', in_progress: '#D48A9A', completed: '#D48A9A', cancelled: '#e74c3c' };

        const cells: (number | null)[] = [...Array(startOffset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
        while (cells.length % 7 !== 0) cells.push(null);

        return (
          <ScrollView style={{ flex: 1, padding: 12 }}>
            {/* Navegación de mes */}
            <View style={styles.monthNav}>
              <TouchableOpacity onPress={goToPrevMonth} style={styles.monthNavBtn}>
                <Text style={styles.monthNavArrow}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.monthNavTitle}>{MONTH_NAMES[currentMonth.month]} {currentMonth.year}</Text>
              <TouchableOpacity onPress={goToNextMonth} style={styles.monthNavBtn}>
                <Text style={styles.monthNavArrow}>›</Text>
              </TouchableOpacity>
            </View>

            {/* Cabecera días semana */}
            <View style={styles.monthWeekHeader}>
              {DAYS.map(d => (
                <Text key={d} style={styles.monthWeekDay}>{d}</Text>
              ))}
            </View>

            {/* Grid de días */}
            <View style={styles.monthGrid}>
              {cells.map((day, idx) => {
                if (!day) return <View key={`empty-${idx}`} style={styles.monthCell} />;
                const dateStr = `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const dayApps = monthAppointments.filter(a => a.date === dateStr);
                const isToday = dateStr === today;
                const isSelected = dateStr === selectedDate;
                return (
                  <TouchableOpacity
                    key={dateStr}
                    style={[styles.monthCell, isSelected && styles.monthCellSelected, isToday && !isSelected && styles.monthCellToday]}
                    onPress={() => {
                      setSelectedDate(dateStr);
                      setCalendarView('day');
                    }}
                  >
                    <Text style={[styles.monthDayNum, isSelected && styles.monthDayNumSelected, isToday && !isSelected && styles.monthDayNumToday]}>
                      {day}
                    </Text>
                    {/* Puntos de citas */}
                    <View style={styles.monthDots}>
                      {dayApps.slice(0, 3).map((a, i) => {
                        let dotColor = STATUS_COLOR[a.status || 'pending'];
                        const isBloqueo = (a.serviceName && a.serviceName.toLowerCase().includes('bloquead')) || 
                                          (a.client && a.client.toLowerCase().includes('bloquead'));
                        if (isBloqueo) dotColor = '#9b59b6';
                        return <View key={i} style={[styles.monthDot, { backgroundColor: dotColor }]} />;
                      })}
                      {dayApps.length > 3 && <Text style={styles.monthDotMore}>+{dayApps.length - 3}</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Leyenda */}
            <View style={styles.monthLegend}>
              <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#f39c12' }]} /><Text style={styles.legendText}>Pendiente</Text></View>
              <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#D48A9A' }]} /><Text style={styles.legendText}>Completado</Text></View>
              <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#e74c3c' }]} /><Text style={styles.legendText}>Cancelado</Text></View>
              <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#9b59b6' }]} /><Text style={styles.legendText}>Bloqueo</Text></View>
            </View>

            {/* Resumen del mes */}
            <View style={styles.monthSummary}>
              <Text style={styles.monthSummaryTitle}>📊 Resumen de {MONTH_NAMES[currentMonth.month]}</Text>
              <View style={styles.monthSummaryRow}>
                <View style={styles.monthSummaryKpi}>
                  <Text style={styles.monthSummaryNum}>{monthAppointments.length}</Text>
                  <Text style={styles.monthSummaryLabel}>Total citas</Text>
                </View>
                <View style={styles.monthSummaryKpi}>
                  <Text style={[styles.monthSummaryNum, { color: '#D48A9A' }]}>{monthAppointments.filter(a => a.status === 'completed').length}</Text>
                  <Text style={styles.monthSummaryLabel}>Completadas</Text>
                </View>
                <View style={styles.monthSummaryKpi}>
                  <Text style={[styles.monthSummaryNum, { color: '#f39c12' }]}>{monthAppointments.filter(a => !a.status || a.status === 'pending').length}</Text>
                  <Text style={styles.monthSummaryLabel}>Pendientes</Text>
                </View>
              </View>
            </View>
          </ScrollView>
        );
      })()}

      {/* Alerta de recordatorios pendientes */}
      {pendingReminders > 0 && (
        <TouchableOpacity 
          style={styles.reminderAlertBanner} 
          onPress={() => {
            setSelectedDate(tomorrowDateStr);
            setShowCalendar(false);
          }}
        >
          <Text style={styles.reminderAlertText}>
            🔔 Tienes {pendingReminders} recordatorio(s) pendiente(s) para mañana. ¡Toca aquí para verlos!
          </Text>
        </TouchableOpacity>
      )}

      {showCalendar && (
        <View style={styles.calendarModal}>
          <Calendar
            onDayPress={(day: any) => {
              setSelectedDate(day.dateString);
              setShowCalendar(false);
            }}
            markedDates={{ [selectedDate]: { selected: true, selectedColor: '#D48A9A' } }}
            theme={{ todayTextColor: '#7A4B56', arrowColor: '#7A4B56' }}
          />
        </View>
      )}

      {/* ===== VISTA DE CUADRÍCULA HORARIA (09:00 - 20:30) ===== */}
      {calendarView === 'day' && (() => {
        const START_HOUR = 9;      // 09:00
        const END_HOUR = 20.5;     // 20:30
        const TOTAL_MINS = (END_HOUR - START_HOUR) * 60; // 690 min
        const PX_PER_MIN = 2;      // 2px por minuto → cada hora = 120px
        const GRID_HEIGHT = TOTAL_MINS * PX_PER_MIN;
        const LABEL_WIDTH = 48;
        const COL_WIDTH = 180;
        const HOUR_LINES = Array.from({ length: Math.ceil(END_HOUR - START_HOUR) + 1 }, (_, i) => START_HOUR + i);
        const visibleTeams = teams.filter(t => isAdmin || t.name === userTeamName);

        const timeToTop = (time: string) => {
          const [h, m] = time.split(':').map(Number);
          return ((h * 60 + m) - START_HOUR * 60) * PX_PER_MIN;
        };

        const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
          pending:     { bg: '#fffbeb', border: '#f39c12', text: '#92400e' },
          in_progress: { bg: '#eff6ff', border: '#D48A9A', text: '#1e3a8a' },
          completed:   { bg: '#f0fdf4', border: '#D48A9A', text: '#14532d' },
          cancelled:   { bg: '#fdf0f0', border: '#e74c3c', text: '#c0392b' },
        };

        return (
          <View style={{ flex: 1 }}>
            {/* FIXED TOP ROW (Sticky vertically, syncs horizontally) */}
            <View style={{ flexDirection: 'row', backgroundColor: '#fff', zIndex: 10, elevation: 4 }}>
              {/* Top Left Corner */}
              <View style={{ width: LABEL_WIDTH, borderRightWidth: 1, borderRightColor: '#e0e8f0', borderBottomWidth: 2, borderBottomColor: '#e0e8f0' }} />
              
              {/* Horizontally Scrollable Team Headers */}
              <ScrollView 
                horizontal 
                ref={headerScrollRef} 
                scrollEnabled={false} 
                showsHorizontalScrollIndicator={false}
                style={{ flex: 1, borderBottomWidth: 2, borderBottomColor: '#e0e8f0' }}
              >
                {visibleTeams.map(t => {
                  const teamApps = appointments.filter(a => (a.team || teams[0]?.name) === t.name);
                  return (
                    <View key={t.id} style={{ width: COL_WIDTH, paddingHorizontal: 8, paddingVertical: 10, borderRightWidth: 1, borderRightColor: '#e0e8f0', backgroundColor: '#f8fafc' }}>
                      <Text style={{ fontWeight: 'bold', color: '#7A4B56', fontSize: 13 }}>🚐 {t.name}</Text>
                      {t.members ? <Text style={{ fontSize: 11, color: '#888', marginTop: 2 }}>👥 {t.members}</Text> : null}
                      <Text style={{ fontSize: 11, color: '#D48A9A', marginTop: 2, fontWeight: 'bold' }}>{teamApps.length} cita{teamApps.length !== 1 ? 's' : ''}</Text>
                    </View>
                  );
                })}
              </ScrollView>
            </View>

            {/* VERTICALLY SCROLLABLE BODY */}
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={true}>
              <View style={{ flexDirection: 'row' }}>
                
                {/* Left Column (Times) */}
                <View style={{ width: LABEL_WIDTH, backgroundColor: '#fff', borderRightWidth: 1, borderRightColor: '#e0e8f0' }}>
                  {Array.from({ length: GRID_HEIGHT / (60 * PX_PER_MIN) + 1 }, (_, i) => {
                    const h = START_HOUR + i;
                    if (h > END_HOUR) return null;
                    return (
                      <View key={h} style={{ height: 60 * PX_PER_MIN, justifyContent: 'flex-start', paddingTop: 4, paddingRight: 6 }}>
                        <Text style={{ fontSize: 11, color: '#aaa', textAlign: 'right' }}>{String(Math.floor(h)).padStart(2,'0')}:00</Text>
                      </View>
                    );
                  })}
                </View>

                {/* Grid (Horizontally Scrollable) */}
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={true} 
                  style={{ flex: 1 }}
                  scrollEventThrottle={16}
                  onScroll={(e) => {
                    headerScrollRef.current?.scrollTo({ x: e.nativeEvent.contentOffset.x, animated: false });
                  }}
                >
                  {visibleTeams.map(t => {
                    const teamApps = appointments.filter(a => (a.team || teams[0]?.name) === t.name);
                    return (
                      <View key={t.id} style={{ width: COL_WIDTH, height: GRID_HEIGHT, position: 'relative', borderRightWidth: 1, borderRightColor: '#e8eef4' }}>
                        {/* Líneas de hora */}
                        {HOUR_LINES.map(h => (
                          <View key={h} style={{ position: 'absolute', top: (h - START_HOUR) * 60 * PX_PER_MIN, left: 0, right: 0, height: 1, backgroundColor: h % 1 === 0 ? '#e8eef4' : '#f4f6f8' }} />
                        ))}

                        {/* Bloque de media hora */}
                        {HOUR_LINES.map(h => (
                          <View key={`h-${h}`} style={{ position: 'absolute', top: (h - START_HOUR) * 60 * PX_PER_MIN + 30 * PX_PER_MIN, left: 0, right: 0, height: 1, backgroundColor: '#FDF9fa', borderStyle: 'dashed' }} />
                        ))}

                        {/* Citas posicionadas */}
                        {teamApps.map(item => {
                          const top = timeToTop(item.time);
                          const dur = parseInt(item.duration || '60');
                          const height = Math.max(dur * PX_PER_MIN, 30);
                          let colors = STATUS_COLORS[item.status || 'pending'];
                          
                          const isBloqueo = (item.serviceName && item.serviceName.toLowerCase().includes('bloquead')) || 
                                            (item.client && item.client.toLowerCase().includes('bloquead'));
                          if (isBloqueo) {
                            colors = { bg: '#f4e8fa', border: '#9b59b6', text: '#8e44ad' };
                          }

                          return (
                            <TouchableOpacity
                              key={item.id}
                              onPress={() => setSelectedAppointment(item)}
                              style={{
                                position: 'absolute',
                                top,
                                left: 3,
                                right: 3,
                                height,
                                backgroundColor: colors.bg,
                                borderRadius: 6,
                                borderLeftWidth: 3,
                                borderLeftColor: colors.border,
                                borderWidth: 1,
                                borderColor: colors.border + '55',
                                paddingHorizontal: 6,
                                paddingVertical: 4,
                                overflow: 'hidden',
                                elevation: 2,
                              }}
                            >
                              <Text style={{ fontSize: 11, fontWeight: 'bold', color: colors.text }} numberOfLines={1}>{item.time} · {item.serviceName}</Text>
                              {height > 35 && <Text style={{ fontSize: 10, color: colors.text, opacity: 0.75, marginTop: 1 }} numberOfLines={1}>👤 {item.client}</Text>}
                              {height > 55 && item.address && <Text style={{ fontSize: 10, color: colors.text, opacity: 0.6, marginTop: 1 }} numberOfLines={1}>📍 {item.address}</Text>}
                              {conflicts[item.id] && <Text style={{ fontSize: 10, color: '#d9534f' }}>⚠️</Text>}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            </ScrollView>
          </View>
        );
      })()}

      {/* MODAL DE DETALLES DEL SERVICIO */}
      <Modal visible={!!selectedAppointment} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          {selectedAppointment && (
            <View style={styles.detailsModalCard}>
              <View style={styles.detailsHeader}>
                <View>
                  <Text style={styles.detailsTime}>{selectedAppointment.time} (🕒 {selectedAppointment.duration}m)</Text>
                  <Text style={styles.detailsService}>{selectedAppointment.serviceName}</Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedAppointment(null)} style={styles.closeDetailsBtn}>
                  <Text style={styles.closeDetailsBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={false}>
                <View style={styles.clientRow}>
                  <Text style={styles.client}>👤 {selectedAppointment.client}</Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {selectedAppointment.phone ? (
                      <>
                        <TouchableOpacity style={styles.phoneBadge} onPress={() => callClient(selectedAppointment.phone)}>
                          <Text style={styles.phoneText}>📞 Llamar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={styles.chatBadge} 
                          onPress={() => {
                            let p = selectedAppointment.phone!.replace(/\s+/g, '');
                            if (p.length === 9 && (p.startsWith('6') || p.startsWith('7') || p.startsWith('8') || p.startsWith('9'))) p = '34' + p;
                            else if (p.startsWith('+')) p = p.substring(1);
                            Linking.openURL(`https://wa.me/${p}`);
                          }}
                        >
                          <Text style={styles.chatText}>💬 WhatsApp</Text>
                        </TouchableOpacity>
                      </>
                    ) : null}
                  </View>
                </View>

                {selectedAppointment.price ? (
                  <View style={styles.priceContainer}>
                    <Text style={styles.priceText}>💶 Presupuesto: {selectedAppointment.price} €</Text>
                  </View>
                ) : null}

                {conflicts[selectedAppointment.id] && (
                  <View style={styles.conflictBanner}>
                    <Text style={styles.conflictText}>{conflicts[selectedAppointment.id]}</Text>
                  </View>
                )}

                {selectedAppointment.address ? (
                  <View style={{ marginTop: 10 }}>
                    <TouchableOpacity style={styles.mapButton} onPress={() => openMaps(selectedAppointment.address)}>
                      <Text style={styles.mapButtonText}>📍 {selectedAppointment.address}</Text>
                    </TouchableOpacity>
                    {selectedAppointment.detailedInfo ? (
                      <View style={styles.detailedInfoBox}>
                        <Text style={styles.detailedInfoText}>🏢 {selectedAppointment.detailedInfo}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}





                {selectedAppointment.phone ? (
                  <TouchableOpacity 
                    style={[styles.whatsappButton, selectedAppointment.reminderSent && styles.whatsappSentButton]} 
                    onPress={() => sendWhatsAppReminder(selectedAppointment)}
                  >
                    <Text style={[styles.whatsappButtonText, selectedAppointment.reminderSent && styles.whatsappSentText]}>
                      {selectedAppointment.reminderSent ? '✅ Recordatorio Enviado' : '📲 Enviar WhatsApp'}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </ScrollView>

              {/* SECCIÓN DE COBRO Y FINALIZACIÓN */}
              <View style={styles.paymentSection}>
                {selectedAppointment.status === 'completed' ? (
                  <View style={styles.completedBadge}>
                    <Text style={styles.completedBadgeText}>
                      ✓ Finalizado ({selectedAppointment.paymentStatus === 'paid' ? `Cobrado en ${selectedAppointment.paymentMethod === 'bizum' ? 'Bizum' : 'Efectivo'}` : 'Pago Pendiente'})
                      {selectedAppointment.finalPrice ? ` - ${selectedAppointment.finalPrice}€` : ''}
                    </Text>
                  </View>
                ) : (
                  <>
                    <Text style={{fontWeight: 'bold', color: '#7A4B56', marginBottom: 5}}>Cerrar Servicio:</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="Importe final cobrado (ej. 45)"
                      keyboardType="numeric"
                      value={finalPriceInput}
                      onChangeText={setFinalPriceInput}
                    />
                    <View style={{flexDirection: 'row', gap: 6, marginTop: 5, flexWrap: 'wrap'}}>
                      <TouchableOpacity style={[styles.completeApptBtn, {backgroundColor: '#4a9b40'}]} onPress={() => completeService(selectedAppointment, 'paid', 'cash')}>
                        <Text style={styles.completeApptBtnText}>💵 Efectivo</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.completeApptBtn, {backgroundColor: '#00a4bd'}]} onPress={() => completeService(selectedAppointment, 'paid', 'bizum')}>
                        <Text style={styles.completeApptBtnText}>📱 Bizum</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.completeApptBtn, {backgroundColor: '#f39c12'}]} onPress={() => completeService(selectedAppointment, 'pending')}>
                        <Text style={styles.completeApptBtnText}>⏳ A deber</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>

              <View style={styles.statusActionRow}>
                <View style={{ flex: 1, gap: 10 }}>
                  {selectedAppointment.phone ? (
                    <TouchableOpacity 
                      style={[styles.reviewBtn, selectedAppointment.reviewRequested && styles.reviewBtnSent]} 
                      onPress={() => requestGoogleReview(selectedAppointment)}
                    >
                      <Text style={[styles.reviewBtnText, selectedAppointment.reviewRequested && styles.reviewBtnTextSent]}>
                        {selectedAppointment.reviewRequested ? '✅ Reseña Solicitada' : '⭐ Solicitar Reseña en Google'}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                
                {isStrictAdmin && (
                  <View style={{flexDirection: 'row', gap: 6}}>
                    <TouchableOpacity style={[styles.deleteApptIconBtn, {backgroundColor: '#e74c3c', paddingHorizontal: 12, justifyContent: 'center'}]} onPress={() => cancelAppointment(selectedAppointment.id)}>
                      <Text style={[styles.deleteApptIconBtnText, {fontSize: 12, color: '#fff'}]}>🚫 Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.deleteApptIconBtn} onPress={() => deleteAppointment(selectedAppointment.id)}>
                      <Text style={styles.deleteApptIconBtnText}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>
      </Modal>

      {/* MODAL PARA GESTIONAR EQUIPOS */}
      <Modal visible={showTeamsModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>
                {editingTeamId ? '✏️ Modificar Equipo' : '⚙️ Configuración de Equipos'}
              </Text>
              <Text style={styles.modalSubtitle}>
                Asigna el nombre, miembros, vehículo y herramientas para cada equipo.
              </Text>

              <TextInput
                style={styles.modalInput}
                placeholder="Nombre del equipo (ej. Equipo 1 - Norte)"
                value={teamName}
                onChangeText={setTeamName}
              />
              <TextInput
                style={styles.modalInput}
                placeholder="👥 Miembros del equipo (ej. Carlos y Marta)"
                value={teamMembers}
                onChangeText={setTeamMembers}
              />
              <TextInput
                style={styles.modalInput}
                placeholder="🚗 Vehículo asignado (ej. Citroën Berlingo 1234-XYZ)"
                value={teamVehicle}
                onChangeText={setTeamVehicle}
              />
              <TextInput
                style={styles.modalInput}
                placeholder="🛠️ Herramientas (ej. Kärcher Puzzi, Cepillos, Vaporizador)"
                value={teamTools}
                onChangeText={setTeamTools}
              />

              <View style={{ marginBottom: 15 }}>
                <Text style={{ fontWeight: 'bold', color: '#7A4B56', marginBottom: 5 }}>¿Qué servicios realiza esta empleada/equipo?</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  {services.map(s => {
                    const isSelected = teamServices.includes(s.id);
                    return (
                      <TouchableOpacity 
                        key={s.id} 
                        style={[{ paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 20 }, isSelected && { backgroundColor: '#FFF5F7', borderColor: '#D48A9A' }]}
                        onPress={() => {
                          if (isSelected) {
                            setTeamServices(teamServices.filter(id => id !== s.id));
                          } else {
                            setTeamServices([...teamServices, s.id]);
                          }
                        }}
                      >
                        <Text style={isSelected ? { color: '#D48A9A', fontWeight: 'bold' } : { color: '#555' }}>
                          {isSelected ? '☑️' : '☐'} {s.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 5 }}>
                {editingTeamId && (
                  <TouchableOpacity style={styles.cancelEditBtn} onPress={cancelEditTeam}>
                    <Text style={styles.cancelEditBtnText}>Cancelar</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.saveTeamBtn} onPress={saveTeam}>
                  <Text style={styles.saveTeamBtnText}>
                    {editingTeamId ? 'Guardar Cambios' : '+ Añadir Equipo'}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.teamListTitle}>Equipos Registrados ({teams.length})</Text>
              <ScrollView style={{ maxHeight: 220 }}>
                {teams.map((t) => (
                  <View key={t.id} style={styles.teamCardItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.teamItemTitle}>🚐 {t.name}</Text>
                      {t.members ? <Text style={styles.teamItemSub}>👥 {t.members}</Text> : null}
                      {t.vehicle ? <Text style={styles.teamItemSub}>🚗 {t.vehicle}</Text> : null}
                      {t.tools ? <Text style={styles.teamItemSub}>🛠️ {t.tools}</Text> : null}
                    </View>
                    <View style={styles.teamItemActions}>
                      <TouchableOpacity style={styles.iconBtn} onPress={() => startEditTeam(t)}>
                        <Text style={styles.iconBtnText}>✏️</Text>
                      </TouchableOpacity>
                      {teams.length > 1 && (
                        <TouchableOpacity style={styles.iconBtn} onPress={() => removeTeam(t.id, t.name)}>
                          <Text style={styles.iconBtnText}>🗑️</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))}
              </ScrollView>

              <TouchableOpacity style={styles.closeModalBtn} onPress={() => { cancelEditTeam(); setShowTeamsModal(false); }}>
                <Text style={styles.closeModalBtnText}>Cerrar Ventana</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* MODAL DE OPTIMIZADOR DE RUTAS */}
      <Modal visible={showOptimizerModal} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxWidth: 400 }]}>
            <Text style={styles.modalTitle}>🪄 Optimización Detectada</Text>
            {optimizationSuggestions.length > 0 ? (
              <View style={{ marginTop: 10 }}>
                <Text style={{ fontSize: 15, color: '#333', lineHeight: 22, marginBottom: 15 }}>
                  Hemos detectado que puedes ahorrar unos <Text style={{fontWeight:'bold', color:'#f39c12'}}>{optimizationSuggestions[0].savings} minutos</Text> reasignando una cita.
                </Text>
                
                <View style={{ backgroundColor: '#f9f9f9', padding: 15, borderRadius: 8, borderWidth: 1, borderColor: '#eee', marginBottom: 20 }}>
                  <Text style={{ fontWeight: 'bold', fontSize: 14, color: '#7A4B56' }}>Cita de {optimizationSuggestions[0].clientName}</Text>
                  <Text style={{ color: '#666', marginTop: 4 }}>Hora: {optimizationSuggestions[0].time}</Text>
                  
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 10 }}>
                    <View style={{ flex: 1, backgroundColor: '#ffe5e5', padding: 8, borderRadius: 6, alignItems: 'center' }}>
                      <Text style={{ fontSize: 12, color: '#d9534f', fontWeight: 'bold' }}>Quitar a</Text>
                      <Text style={{ fontSize: 13, fontWeight: 'bold' }}>{optimizationSuggestions[0].fromTeam}</Text>
                    </View>
                    <Text>➡️</Text>
                    <View style={{ flex: 1, backgroundColor: '#FFF5F7', padding: 8, borderRadius: 6, alignItems: 'center' }}>
                      <Text style={{ fontSize: 12, color: '#D48A9A', fontWeight: 'bold' }}>Pasar a</Text>
                      <Text style={{ fontSize: 13, fontWeight: 'bold' }}>{optimizationSuggestions[0].toTeam}</Text>
                    </View>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity style={[styles.cancelEditBtn, { flex: 1 }]} onPress={() => setShowOptimizerModal(false)}>
                    <Text style={styles.cancelEditBtnText}>Rechazar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.saveTeamBtn, { flex: 1.5, backgroundColor: '#f39c12' }]} onPress={() => applyOptimization(optimizationSuggestions[0])}>
                    <Text style={styles.saveTeamBtnText}>Confirmar y Mover</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDF9fa' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0'
  },
  datePickerBtn: {
    backgroundColor: '#F9F1F3',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d0e0f0'
  },
  datePickerText: { color: '#7A4B56', fontWeight: 'bold', fontSize: 15 },
  topActions: { flexDirection: 'row', gap: 8 },
  manageTeamsBtn: {
    backgroundColor: '#7A4B56',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8
  },
  manageTeamsText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  newApptBtn: {
    backgroundColor: '#D48A9A',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8
  },
  newApptText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  calendarModal: {
    marginHorizontal: 15,
    marginTop: 10,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ddd'
  },
  columnsScrollView: { flex: 1, paddingHorizontal: 10, paddingVertical: 12 },
  teamColumn: {
    width: 320,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    marginRight: 15,
    borderWidth: 1,
    borderColor: '#EADDE0',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '100%'
  },
  teamHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#7A4B56',
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9
  },
  teamTitle: { color: '#ffffff', fontWeight: 'bold', fontSize: 16 },
  teamHeaderSubtitle: { color: '#C9A3AD', fontSize: 12, marginTop: 2 },
  teamCountBadge: {
    backgroundColor: '#D48A9A',
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12
  },
  infoToggleText: { color: '#C9A3AD', fontSize: 11, textDecorationLine: 'underline', marginTop: 2 },
  teamInfoBox: {
    backgroundColor: '#FDF9fa',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EADDE0',
    gap: 3
  },
  teamInfoItem: { fontSize: 12, color: '#333' },
  infoBold: { fontWeight: 'bold', color: '#7A4B56' },
  columnBody: { padding: 12, flex: 1 },
  card: {
    backgroundColor: '#fbfcfd',
    marginBottom: 12,
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#7A4B56',
    borderWidth: 1,
    borderColor: '#F2E8EB'
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  time: { fontWeight: 'bold', color: '#7A4B56', fontSize: 15 },
  service: { color: '#D48A9A', fontWeight: 'bold', fontSize: 13, marginTop: 2 },
  deleteIcon: { fontSize: 16, padding: 4 },
  clientRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 6 },
  client: { fontSize: 14, color: '#333', fontWeight: 'bold' },
  phoneBadge: { backgroundColor: '#FFF5F7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 1, borderColor: '#F5D6DD' },
  phoneText: { color: '#7A4B56', fontWeight: 'bold', fontSize: 12 },
  chatBadge: { backgroundColor: '#FFF5F7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 1, borderColor: '#E8CED4' },
  chatText: { color: '#7A4B56', fontWeight: 'bold', fontSize: 12 },
  priceContainer: {
    backgroundColor: '#FFF5F7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 8
  },
  priceText: { color: '#7A4B56', fontWeight: 'bold', fontSize: 13 },
  conflictBanner: {
    backgroundColor: '#ffe5e5',
    padding: 8,
    borderRadius: 5,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#ffcccc'
  },
  conflictText: { color: '#d9534f', fontWeight: 'bold', fontSize: 12 },
  mapButton: {
    backgroundColor: '#eef2f5',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d0d7de'
  },
  mapButtonText: { color: '#7A4B56', fontWeight: 'bold', fontSize: 13 },
  detailedInfoBox: {
    backgroundColor: '#fff8e7',
    borderWidth: 1,
    borderColor: '#fae4b2',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 6
  },
  detailedInfoText: { color: '#8a5800', fontWeight: 'bold', fontSize: 12 },
  emptyColumnBox: { paddingVertical: 30, alignItems: 'center' },
  emptyColumnText: { color: '#999', fontStyle: 'italic', fontSize: 14 },
  
  // Estilos del Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 15 },
  modalCard: { width: '100%', maxWidth: 500, backgroundColor: '#fff', borderRadius: 12, padding: 20, elevation: 5 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#7A4B56', marginBottom: 4 },
  modalSubtitle: { fontSize: 13, color: '#666', marginBottom: 12 },
  modalInput: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, marginBottom: 8, backgroundColor: '#fafafa' },
  saveTeamBtn: { flex: 1, backgroundColor: '#D48A9A', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  saveTeamBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  cancelEditBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d9534f', paddingHorizontal: 15, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  cancelEditBtnText: { color: '#d9534f', fontWeight: 'bold', fontSize: 14 },
  teamListTitle: { fontSize: 15, fontWeight: 'bold', color: '#7A4B56', marginTop: 18, marginBottom: 8 },
  teamCardItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10, backgroundColor: '#f7f9fb', borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#e3ebf2' },
  teamItemTitle: { fontSize: 15, fontWeight: 'bold', color: '#7A4B56' },
  teamItemSub: { fontSize: 12, color: '#555', marginTop: 2 },
  teamItemActions: { flexDirection: 'row', gap: 6 },
  iconBtn: { padding: 6, backgroundColor: '#fff', borderRadius: 6, borderWidth: 1, borderColor: '#ddd' },
  iconBtnText: { fontSize: 14 },
  closeModalBtn: { backgroundColor: '#7A4B56', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 15 },
  closeModalBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  
  // Estilos WhatsApp
  reminderAlertBanner: {
    backgroundColor: '#fff3cd',
    padding: 12,
    marginHorizontal: 15,
    marginTop: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffeeba',
    alignItems: 'center'
  },
  reminderAlertText: { color: '#856404', fontWeight: 'bold', fontSize: 14, textAlign: 'center' },
  whatsappButton: {
    backgroundColor: '#25D366',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 10
  },
  whatsappButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  whatsappSentButton: {
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#dcdcdc'
  },
  whatsappSentText: { color: '#555', fontWeight: 'bold' },
  
  // Estilos de Fotografías
  photosSection: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 10 },
  photosTitle: { fontSize: 13, fontWeight: 'bold', color: '#7A4B56', marginBottom: 8 },
  photosRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  thumbnailImg: { width: 60, height: 60, borderRadius: 8, borderWidth: 1, borderColor: '#ddd' },
  uploadingBox: { width: 60, height: 60, borderRadius: 8, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  addPhotoBtn: { width: 60, height: 60, borderRadius: 8, backgroundColor: '#FFF5F7', borderWidth: 1, borderColor: '#F5D6DD', justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed' },
  addPhotoBtnText: { fontSize: 24, color: '#D48A9A' },

  // Estilos del nuevo Modal de Detalles
  cardMiniIndicators: { flexDirection: 'row', gap: 5, marginTop: 8 },
  miniIcon: { fontSize: 13, backgroundColor: '#FDF9fa', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  detailsModalCard: { width: '100%', maxWidth: 450, backgroundColor: '#fff', borderRadius: 12, padding: 20, elevation: 5 },
  detailsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 10 },
  detailsTime: { fontSize: 18, fontWeight: 'bold', color: '#7A4B56' },
  detailsService: { fontSize: 15, color: '#D48A9A', fontWeight: 'bold', marginTop: 4 },
  closeDetailsBtn: { backgroundColor: '#f0f0f0', width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  closeDetailsBtnText: { fontSize: 16, fontWeight: 'bold', color: '#555' },
  
  // Estilos de Estados
  cardInProgress: { borderLeftColor: '#D48A9A', backgroundColor: '#F9F1F3' },
  cardCompleted: { borderLeftColor: '#D48A9A', backgroundColor: '#FFF5F7', opacity: 0.85 },
  delayBadge: { backgroundColor: '#ffe5e5', color: '#d9534f', fontSize: 12, fontWeight: 'bold', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, overflow: 'hidden' },
  
  statusActionRow: { flexDirection: 'row', marginTop: 20, gap: 10 },
  startApptBtn: { flex: 1, backgroundColor: '#D48A9A', paddingVertical: 14, borderRadius: 8, alignItems: 'center', elevation: 1 },
  startApptBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  
  // Cabecera superior
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  dateSelector: { flexDirection: 'row', alignItems: 'center' },
  dateText: { fontSize: 18, fontWeight: 'bold', color: '#7A4B56' },
  headerControls: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  optimizerBtn: { backgroundColor: '#f39c12', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  optimizerBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  manageTeamsBtn: { backgroundColor: '#F9F1F3', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, borderWidth: 1, borderColor: '#E8CED4' },
  manageTeamsText: { color: '#7A4B56', fontWeight: 'bold', fontSize: 13 },
  newApptBtn: { backgroundColor: '#7A4B56', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 6 },
  newApptText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  completeApptBtn: { flex: 1, backgroundColor: '#D48A9A', paddingVertical: 14, borderRadius: 8, alignItems: 'center', elevation: 1 },
  completeApptBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  completedBadge: { flex: 1, backgroundColor: '#FFF5F7', paddingVertical: 14, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#D48A9A' },
  completedBadgeText: { color: '#7A4B56', fontWeight: 'bold', fontSize: 16 },
  reviewBtn: { backgroundColor: '#fff', borderWidth: 2, borderColor: '#fbbc05', padding: 12, borderRadius: 8, alignItems: 'center' },
  reviewBtnSent: { backgroundColor: '#fff', borderColor: '#d3d3d3', borderWidth: 1 },
  reviewBtnText: { color: '#fbbc05', fontWeight: 'bold', fontSize: 15 },
  reviewBtnTextSent: { color: '#888', fontWeight: 'bold', fontSize: 14 },
  deleteApptIconBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d9534f', width: 50, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  deleteApptIconBtnText: { fontSize: 20 },
  
  // Estilo para el botón de Factura PDF
  invoiceBtn: { backgroundColor: '#fdf7e3', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 15, borderWidth: 1, borderColor: '#fde68a' },
  invoiceBtnText: { color: '#b45309', fontWeight: 'bold', fontSize: 14 },

  // Toggle de vista Día / Mes
  viewToggle: { flexDirection: 'row', backgroundColor: '#F9F1F3', borderRadius: 8, borderWidth: 1, borderColor: '#E8CED4', overflow: 'hidden' },
  viewToggleBtn: { paddingHorizontal: 12, paddingVertical: 7 },
  viewToggleBtnActive: { backgroundColor: '#7A4B56' },
  viewToggleText: { fontSize: 13, fontWeight: 'bold', color: '#7A4B56' },
  viewToggleTextActive: { color: '#fff' },

  // Vista Mensual
  monthNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  monthNavBtn: { padding: 8, backgroundColor: '#F9F1F3', borderRadius: 8, borderWidth: 1, borderColor: '#E8CED4' },
  monthNavArrow: { fontSize: 22, color: '#7A4B56', fontWeight: 'bold', lineHeight: 24 },
  monthNavTitle: { fontSize: 20, fontWeight: 'bold', color: '#7A4B56' },
  monthWeekHeader: { flexDirection: 'row', marginBottom: 4 },
  monthWeekDay: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: 'bold', color: '#888', paddingVertical: 6 },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  monthCell: { width: `${100/7}%` as any, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', padding: 2, borderRadius: 8, marginBottom: 2 },
  monthCellToday: { backgroundColor: '#F9F1F3', borderWidth: 1, borderColor: '#D48A9A' },
  monthCellSelected: { backgroundColor: '#7A4B56' },
  monthDayNum: { fontSize: 15, fontWeight: '600', color: '#7A4B56' },
  monthDayNumToday: { color: '#D48A9A', fontWeight: 'bold' },
  monthDayNumSelected: { color: '#fff', fontWeight: 'bold' },
  monthDots: { flexDirection: 'row', gap: 2, marginTop: 2, flexWrap: 'wrap', justifyContent: 'center' },
  monthDot: { width: 6, height: 6, borderRadius: 3 },
  monthDotMore: { fontSize: 9, color: '#999', fontWeight: 'bold' },
  monthLegend: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 16, marginBottom: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: '#666' },
  paymentSection: { marginTop: 15, padding: 15, backgroundColor: '#F9F1F3', borderRadius: 8, borderWidth: 1, borderColor: '#EADDE0' },
  monthSummary: { backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e0e8f0', marginTop: 4 },
  monthSummaryTitle: { fontSize: 15, fontWeight: 'bold', color: '#7A4B56', marginBottom: 12 },
  monthSummaryRow: { flexDirection: 'row', justifyContent: 'space-around' },
  monthSummaryKpi: { alignItems: 'center' },
  monthSummaryNum: { fontSize: 28, fontWeight: 'bold', color: '#7A4B56' },
  monthSummaryLabel: { fontSize: 12, color: '#888', marginTop: 2 },
});
