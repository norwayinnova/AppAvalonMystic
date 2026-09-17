import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Linking } from 'react-native';
import { collection, query, onSnapshot, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Calendar } from 'react-native-calendars';

export default function ClientBookingScreen({ navigation }: any) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  
  // Data
  const [services, setServices] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  
  // Selection
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [selectedService, setSelectedService] = useState<any>(null);
  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  
  // Fidelity
  const [isTenthAppointment, setIsTenthAppointment] = useState(false);

  // Available slots logic
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [isCalculatingSlots, setIsCalculatingSlots] = useState(false);

  useEffect(() => {
    // Load services
    const qSrv = query(collection(db, 'services'));
    const unSrv = onSnapshot(qSrv, snap => {
      const list: any[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setServices(list);
    });

    // Load teams
    const qTeams = query(collection(db, 'teams'));
    const unTeams = onSnapshot(qTeams, snap => {
      const list: any[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setTeams(list);
      setLoading(false);
    });

    return () => { unSrv(); unTeams(); };
  }, []);

  useEffect(() => {
    if (selectedDate && selectedService && selectedTeam) {
      calculateSlots();
    }
  }, [selectedDate, selectedService, selectedTeam]);

  const calculateSlots = async () => {
    setIsCalculatingSlots(true);
    try {
      // Get all appointments for that day
      const qApps = query(collection(db, 'appointments'), where('date', '==', selectedDate));
      const snap = await getDocs(qApps);
      
      const allApps: any[] = [];
      snap.forEach(d => allApps.push(d.data()));

      // Generate all possible slots 09:00 to 20:00 every 30 mins
      const allSlots: string[] = [];
      for (let h = 9; h <= 20; h++) {
        for (let m = 0; m < 60; m += 30) {
          if (h === 20 && m > 0) continue;
          allSlots.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
        }
      }

      const getMins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
      const duration = parseInt(selectedService.duration || '60');

      let teamsToCheck = selectedTeam.id === 'any' 
        ? teams.filter(t => !selectedService?.allowedTeams || selectedService.allowedTeams.includes(t.name)) 
        : [selectedTeam];
      const validSlots = new Set<string>();

      teamsToCheck.forEach(teamObj => {
        const teamApps = allApps.filter(app => (app.team || teams[0]?.name) === teamObj.name && app.status !== 'cancelled');
        
        allSlots.forEach(slot => {
          const slotStart = getMins(slot);
          const slotEnd = slotStart + duration;

          const hasConflict = teamApps.some(app => {
            const appStart = getMins(app.time);
            const appEnd = appStart + parseInt(app.duration || '60');
            const isBloqueo = (app.serviceName && app.serviceName.toLowerCase().includes('bloquead')) || 
                              (app.client && app.client.toLowerCase().includes('bloquead'));

            if (slotStart < appEnd && slotEnd > appStart) {
              if (isBloqueo && slotStart < appStart) return false;
              return true;
            }
            return false;
          });

          if (!hasConflict) {
            validSlots.add(slot);
          }
        });
      });

      const sortedSlots = Array.from(validSlots).sort();
      setAvailableSlots(sortedSlots);
    } catch (e) {
      console.log('Error calculating slots', e);
    } finally {
      setIsCalculatingSlots(false);
    }
  };

  const handleNextStep = async () => {
    if (step === 1) {
      if (!clientName.trim() || !clientPhone.trim() || clientPhone.length < 6) {
        alert('Por favor, introduce tu nombre y un teléfono válido.');
        return;
      }
      // Check fidelity silently
      try {
        const qFidel = query(collection(db, 'appointments'), where('phone', '==', clientPhone.trim()), where('status', '==', 'completed'));
        const snap = await getDocs(qFidel);
        if (snap.size === 9) setIsTenthAppointment(true);
        else setIsTenthAppointment(false);
      } catch (e) {
        // ignore
      }
      setStep(2);
    } else if (step === 2) {
      if (!selectedService) {
        alert('Selecciona un servicio.');
        return;
      }
      setStep(3);
    } else if (step === 3) {
      if (!selectedTeam) {
        alert('Selecciona a una profesional.');
        return;
      }
      setStep(4);
    }
  };

  const saveBooking = async () => {
    try {
      let assignedTeamName = selectedTeam.name;

      if (selectedTeam.id === 'any') {
        // Find which team is actually free at the selectedTime
        const qApps = query(collection(db, 'appointments'), where('date', '==', selectedDate));
        const snap = await getDocs(qApps);
        const allApps: any[] = [];
        snap.forEach(d => allApps.push(d.data()));

        const getMins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
        const slotStart = getMins(selectedTime);
        const duration = parseInt(selectedService.duration || '60');
        const slotEnd = slotStart + duration;

        const availableTeam = teams
          .filter(t => !selectedService?.allowedTeams || selectedService.allowedTeams.includes(t.name))
          .find(teamObj => {
          const teamApps = allApps.filter(app => (app.team || teams[0]?.name) === teamObj.name && app.status !== 'cancelled');
          const hasConflict = teamApps.some(app => {
            const appStart = getMins(app.time);
            const appEnd = appStart + parseInt(app.duration || '60');
            const isBloqueo = (app.serviceName && app.serviceName.toLowerCase().includes('bloquead')) || 
                              (app.client && app.client.toLowerCase().includes('bloquead'));
            if (slotStart < appEnd && slotEnd > appStart) {
              if (isBloqueo && slotStart < appStart) return false;
              return true;
            }
            return false;
          });
          return !hasConflict;
        });

        if (availableTeam) {
          assignedTeamName = availableTeam.name;
        } else {
           throw new Error('No hay equipos disponibles en este horario.');
        }
      }

      let finalNotes = 'Reserva Online - Fianza pagada';
      if (isTenthAppointment) {
        finalNotes += '\n🌟 10ª Cita - APLICAR 20% DESCUENTO';
      }

      await addDoc(collection(db, 'appointments'), {
        client: clientName.trim(),
        phone: clientPhone.trim(),
        date: selectedDate,
        time: selectedTime,
        serviceName: selectedService.name,
        duration: selectedService.duration || '60',
        price: selectedService.price || '0',
        team: assignedTeamName,
        status: 'pending',
        paymentStatus: 'pending', // La fianza está pagada, pero el total queda pendiente
        notes: finalNotes
      });
      alert('¡Tu reserva ha sido confirmada con éxito! Te esperamos en Avalon Mystic.');
      // Reiniciar
      setStep(1);
      setClientName('');
      setClientPhone('');
      setSelectedDate('');
      setSelectedTime('');
      setSelectedService(null);
      setSelectedTeam(null);
      setIsTenthAppointment(false);
    } catch (e: any) {
      alert(e.message || 'Hubo un error al guardar la reserva.');
    }
  };

  const handleBook = () => {
    if (!selectedDate || !selectedTime) {
      alert('Selecciona fecha y hora.');
      return;
    }
    if (window.confirm('Para confirmar la cita, debes abonar una fianza de reserva (10€) que se descontará del precio final. Serás redirigido a la pasarela de pago seguro. ¿Deseas continuar?')) {
      saveBooking();
    }
  };

  if (loading) {
    return <ActivityIndicator size="large" color="#D48A9A" style={{flex:1, justifyContent:'center'}} />;
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Avalon Mystic</Text>
        <Text style={styles.subtitle}>Reserva tu cita online</Text>
      </View>

      {/* STEP 1 */}
      {step === 1 && (
        <View style={styles.card}>
          <Text style={styles.stepTitle}>1. Tus Datos</Text>
          <TextInput style={styles.input} placeholder="Tu Nombre Completo" value={clientName} onChangeText={setClientName} />
          <TextInput style={styles.input} placeholder="Tu Teléfono (ej. 600123456)" keyboardType="phone-pad" value={clientPhone} onChangeText={setClientPhone} />
          <TouchableOpacity style={styles.btnAction} onPress={handleNextStep}>
            <Text style={styles.btnText}>Siguiente ›</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* STEP 2 */}
      {step === 2 && (
        <View style={styles.card}>
          <Text style={styles.stepTitle}>2. Elige el Servicio</Text>
          <View style={styles.grid}>
            {services.map(s => (
              <TouchableOpacity key={s.id} style={[styles.optionCard, selectedService?.id === s.id && styles.optionSelected]} onPress={() => setSelectedService(s)}>
                <Text style={[styles.optionTitle, selectedService?.id === s.id && styles.textSelected]}>{s.name}</Text>
                <Text style={styles.optionSub}>⏱ {s.duration} min | {s.price ? `💶 ${s.price}€` : ''}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.navRow}>
            <TouchableOpacity style={styles.btnBack} onPress={() => setStep(1)}><Text style={styles.btnBackText}>‹ Volver</Text></TouchableOpacity>
            <TouchableOpacity style={styles.btnAction} onPress={handleNextStep}><Text style={styles.btnText}>Siguiente ›</Text></TouchableOpacity>
          </View>
        </View>
      )}

      {/* STEP 3 */}
      {step === 3 && (
        <View style={styles.card}>
          <Text style={styles.stepTitle}>3. ¿Con quién quieres tu cita?</Text>
          <View style={styles.grid}>
            <TouchableOpacity style={[styles.optionCard, selectedTeam?.id === 'any' && styles.optionSelected]} onPress={() => setSelectedTeam({id: 'any', name: 'Cualquiera'})}>
              <Text style={[styles.optionTitle, selectedTeam?.id === 'any' && styles.textSelected]}>💇‍♀️ Sin preferencia (Cualquiera)</Text>
            </TouchableOpacity>
            {teams
              .filter(t => !selectedService?.allowedTeams || selectedService.allowedTeams.includes(t.name))
              .map(t => (
              <TouchableOpacity key={t.id} style={[styles.optionCard, selectedTeam?.id === t.id && styles.optionSelected]} onPress={() => setSelectedTeam(t)}>
                <Text style={[styles.optionTitle, selectedTeam?.id === t.id && styles.textSelected]}>💇‍♀️ {t.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.navRow}>
            <TouchableOpacity style={styles.btnBack} onPress={() => setStep(2)}><Text style={styles.btnBackText}>‹ Volver</Text></TouchableOpacity>
            <TouchableOpacity style={styles.btnAction} onPress={handleNextStep}><Text style={styles.btnText}>Siguiente ›</Text></TouchableOpacity>
          </View>
        </View>
      )}

      {/* STEP 4 */}
      {step === 4 && (
        <View style={styles.card}>
          <Text style={styles.stepTitle}>4. Elige Fecha y Hora</Text>
          <Calendar
            onDayPress={(day: any) => { setSelectedDate(day.dateString); setSelectedTime(''); }}
            markedDates={{ [selectedDate]: { selected: true, selectedColor: '#D48A9A' } }}
            minDate={new Date().toISOString().split('T')[0]}
            theme={{ todayTextColor: '#7A4B56', arrowColor: '#7A4B56' }}
          />
          
          {selectedDate ? (
            isCalculatingSlots ? (
              <ActivityIndicator size="small" color="#D48A9A" style={{marginTop: 20}} />
            ) : availableSlots.length > 0 ? (
              <View style={styles.timeGrid}>
                {availableSlots.map(time => (
                  <TouchableOpacity key={time} style={[styles.timeSlot, selectedTime === time && styles.timeSlotSelected]} onPress={() => setSelectedTime(time)}>
                    <Text style={[styles.timeText, selectedTime === time && styles.timeTextSelected]}>{time}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Text style={styles.noSlotsText}>No hay huecos disponibles este día para la empleada seleccionada.</Text>
            )
          ) : (
            <Text style={styles.noSlotsText}>Selecciona un día en el calendario.</Text>
          )}

          <View style={styles.navRow}>
            <TouchableOpacity style={styles.btnBack} onPress={() => setStep(3)}><Text style={styles.btnBackText}>‹ Volver</Text></TouchableOpacity>
            <TouchableOpacity style={styles.btnAction} onPress={handleBook}><Text style={styles.btnText}>Confirmar y Pagar Fianza</Text></TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f4f7' },
  header: { padding: 30, backgroundColor: '#D48A9A', alignItems: 'center' },
  title: { fontSize: 26, fontWeight: 'bold', color: '#fff' },
  subtitle: { fontSize: 16, color: '#fff', opacity: 0.9, marginTop: 5 },
  card: { backgroundColor: '#fff', margin: 15, borderRadius: 12, padding: 20, elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowOffset: {width:0, height:2} },
  stepTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 20, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 15, borderRadius: 10, fontSize: 16, marginBottom: 15, backgroundColor: '#fafafa' },
  
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  optionCard: { width: '48%', borderWidth: 1, borderColor: '#eee', padding: 15, borderRadius: 10, marginBottom: 15, alignItems: 'center', backgroundColor: '#fafafa' },
  optionSelected: { borderColor: '#D48A9A', backgroundColor: '#fdf5f7' },
  optionTitle: { fontWeight: 'bold', color: '#555', textAlign: 'center' },
  optionSub: { fontSize: 12, color: '#888', marginTop: 5 },
  textSelected: { color: '#D48A9A' },

  navRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  btnAction: { backgroundColor: '#D48A9A', paddingVertical: 15, paddingHorizontal: 20, borderRadius: 10, flex: 1, alignItems: 'center', marginLeft: 5 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  btnBack: { backgroundColor: '#eee', paddingVertical: 15, paddingHorizontal: 20, borderRadius: 10, flex: 1, alignItems: 'center', marginRight: 5 },
  btnBackText: { color: '#555', fontSize: 16, fontWeight: 'bold' },

  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', marginTop: 20 },
  timeSlot: { width: '22%', borderWidth: 1, borderColor: '#2ecc71', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginBottom: 10, marginRight: '3%', backgroundColor: '#fdfdfd' },
  timeSlotSelected: { backgroundColor: '#2ecc71' },
  timeText: { color: '#2ecc71', fontWeight: 'bold', fontSize: 16 },
  timeTextSelected: { color: '#fff' },
  noSlotsText: { textAlign: 'center', marginTop: 20, color: '#888', fontStyle: 'italic' }
});
