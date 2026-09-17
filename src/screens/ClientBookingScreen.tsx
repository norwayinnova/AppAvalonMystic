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
      // Get all appointments for that day and team
      const qApps = query(collection(db, 'appointments'), where('date', '==', selectedDate));
      const snap = await getDocs(qApps);
      
      const teamApps: any[] = [];
      snap.forEach(d => {
        const app = d.data();
        if ((app.team || teams[0]?.name) === selectedTeam.name && app.status !== 'cancelled') {
           teamApps.push(app);
        }
      });

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

      const freeSlots = allSlots.filter(slot => {
        const slotStart = getMins(slot);
        const slotEnd = slotStart + duration;

        // Check against all existing appointments
        const hasConflict = teamApps.some(app => {
          const appStart = getMins(app.time);
          const appEnd = appStart + parseInt(app.duration || '60');
          return (slotStart < appEnd && slotEnd > appStart);
        });

        return !hasConflict;
      });

      setAvailableSlots(freeSlots);
    } catch (e) {
      console.log('Error calculating slots', e);
    } finally {
      setIsCalculatingSlots(false);
    }
  };

  const handleNextStep = () => {
    if (step === 1) {
      if (!clientName.trim() || !clientPhone.trim() || clientPhone.length < 6) {
        alert('Por favor, introduce tu nombre y un teléfono válido.');
        return;
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

  const handleBook = () => {
    if (!selectedDate || !selectedTime) {
      alert('Selecciona fecha y hora.');
      return;
    }
    
    // Simulate Stripe Payment
    if (window.confirm('Para confirmar la cita, debes abonar una fianza de reserva (10€) que se descontará del precio final. Serás redirigido a la pasarela de pago seguro. ¿Deseas continuar?')) {
      // En un futuro aquí se abre el Link de Pago de Stripe
      // window.open('https://buy.stripe.com/tu-link-de-pago', '_blank');
      
      // Simulamos que el pago se completa y guardamos la cita
      saveBooking();
    }
  };

  const saveBooking = async () => {
    try {
      await addDoc(collection(db, 'appointments'), {
        client: clientName.trim(),
        phone: clientPhone.trim(),
        date: selectedDate,
        time: selectedTime,
        serviceName: selectedService.name,
        duration: selectedService.duration || '60',
        price: selectedService.price || '0',
        team: selectedTeam.name,
        status: 'pending',
        paymentStatus: 'pending', // La fianza está pagada, pero el total queda pendiente
        notes: 'Reserva Online - Fianza pagada'
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
    } catch (e) {
      alert('Hubo un error al guardar la reserva.');
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
            {teams.map(t => (
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
            <View style={{marginTop: 20}}>
              <Text style={{fontWeight:'bold', marginBottom: 10, color:'#7A4B56'}}>Horas disponibles para el {selectedDate}:</Text>
              {isCalculatingSlots ? (
                <ActivityIndicator color="#D48A9A" />
              ) : availableSlots.length > 0 ? (
                <View style={styles.timeGrid}>
                  {availableSlots.map(time => (
                    <TouchableOpacity key={time} style={[styles.timeChip, selectedTime === time && styles.timeSelected]} onPress={() => setSelectedTime(time)}>
                      <Text style={[styles.timeText, selectedTime === time && styles.textSelected]}>{time}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <Text style={{color: '#c0392b'}}>Lo sentimos, no quedan huecos libres este día para este servicio.</Text>
              )}
            </View>
          ) : null}

          <View style={[styles.navRow, {marginTop: 30}]}>
            <TouchableOpacity style={styles.btnBack} onPress={() => setStep(3)}><Text style={styles.btnBackText}>‹ Volver</Text></TouchableOpacity>
            {selectedDate && selectedTime && (
              <TouchableOpacity style={styles.btnPay} onPress={handleBook}>
                <Text style={styles.btnText}>💳 Reservar y Pagar Fianza</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
      
      <View style={{height: 100}} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fcf8f9', padding: 20 },
  header: { alignItems: 'center', marginVertical: 30 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#7A4B56' },
  subtitle: { fontSize: 16, color: '#D48A9A', marginTop: 5 },
  card: { backgroundColor: '#fff', padding: 20, borderRadius: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, elevation: 3 },
  stepTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 20 },
  input: { backgroundColor: '#f5f7fa', padding: 15, borderRadius: 10, marginBottom: 15, fontSize: 16 },
  btnAction: { backgroundColor: '#7A4B56', padding: 15, borderRadius: 10, alignItems: 'center' },
  btnPay: { backgroundColor: '#27ae60', padding: 15, borderRadius: 10, alignItems: 'center', flex: 1, marginLeft: 10 },
  btnBack: { backgroundColor: '#e0e8f0', padding: 15, borderRadius: 10, alignItems: 'center', flex: 1, marginRight: 10 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  btnBackText: { color: '#555', fontWeight: 'bold', fontSize: 16 },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  optionCard: { width: '48%', backgroundColor: '#f5f7fa', padding: 15, borderRadius: 10, borderWidth: 2, borderColor: 'transparent', alignItems: 'center' },
  optionSelected: { borderColor: '#D48A9A', backgroundColor: '#fff5f7' },
  optionTitle: { fontWeight: 'bold', color: '#333', textAlign: 'center', marginBottom: 5 },
  optionSub: { fontSize: 12, color: '#777' },
  textSelected: { color: '#7A4B56' },
  textUnselected: { color: '#555' },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  timeChip: { backgroundColor: '#f5f7fa', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, borderWidth: 1, borderColor: '#e0e8f0' },
  timeSelected: { backgroundColor: '#7A4B56', borderColor: '#7A4B56' },
  timeText: { color: '#333', fontWeight: 'bold' }
});
