import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Linking
} from 'react-native';
import { collection, addDoc, updateDoc, doc, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { Calendar } from 'react-native-calendars';
import { db } from '../config/firebase';

export default function AppointmentsScreen({ navigation }: any) {
  const [client, setClient] = useState('');
  const [phone, setPhone] = useState('');
  const [existingClientData, setExistingClientData] = useState<any>(null);

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('');
  
  // Dirección y validación optimizada
  const [addressInput, setAddressInput] = useState('');
  const [validatedAddress, setValidatedAddress] = useState<string | null>(null);
  const [detailedInfo, setDetailedInfo] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [isValidated, setIsValidated] = useState(false);

  const [price, setPrice] = useState('');
  const [team, setTeam] = useState('Equipo 1');
  const [teams, setTeams] = useState<any[]>([]);
  const [showCalendar, setShowCalendar] = useState(false);
  
  const [services, setServices] = useState<any[]>([]);
  const [selectedService, setSelectedService] = useState<any>(null);
  
  const [existingAppointments, setExistingAppointments] = useState<any[]>([]);
  const [smartSuggestion, setSmartSuggestion] = useState<any>(null);

  // 1. Cargar Equipos dinámicos desde Firestore
  useEffect(() => {
    const qTeams = query(collection(db, 'teams'));
    const unsubscribeTeams = onSnapshot(qTeams, (snapshot) => {
      const teamsList: any[] = [];
      snapshot.forEach(docSnap => teamsList.push({ id: docSnap.id, ...docSnap.data() }));
      teamsList.sort((a, b) => a.name.localeCompare(b.name));
      setTeams(teamsList);
      if (teamsList.length > 0 && !team) {
        setTeam(teamsList[0].name);
      }
    });
    return () => unsubscribeTeams();
  }, []);

  // 2. Cargar Servicios
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'services'), (snapshot) => {
      const srvs: any[] = [];
      snapshot.forEach(docSnap => srvs.push({ id: docSnap.id, ...docSnap.data() }));
      setServices(srvs);
    });
    return () => unsubscribe();
  }, []);

  // 3. Cargar Citas para el día seleccionado
  useEffect(() => {
    const q = query(collection(db, 'appointments'), where('date', '==', date));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const appsList: any[] = [];
      snapshot.forEach(docSnap => appsList.push({ id: docSnap.id, ...docSnap.data() }));
      setExistingAppointments(appsList);
    });
    return () => unsubscribe();
  }, [date]);

  // BUSCADOR AUTOMÁTICO DE CLIENTES POR TELÉFONO
  const handlePhoneChange = async (text: string) => {
    setPhone(text);
    const cleanPhone = text.trim();
    if (cleanPhone.length >= 6) {
      try {
        const qClient = query(collection(db, 'clients'), where('phone', '==', cleanPhone));
        const snap = await getDocs(qClient);
        if (!snap.empty) {
          const clientFound = { id: snap.docs[0].id, ...snap.docs[0].data() };
          setExistingClientData(clientFound);
        } else {
          setExistingClientData(null);
        }
      } catch (e) {
        console.log(e);
      }
    } else {
      setExistingClientData(null);
    }
  };

  const autofillClient = () => {
    if (existingClientData) {
      if (existingClientData.name) setClient(existingClientData.name);
      if (existingClientData.address) {
        setAddressInput(existingClientData.address);
        setValidatedAddress(existingClientData.address);
        setIsValidated(true);
      }
      if (existingClientData.detailedInfo) setDetailedInfo(existingClientData.detailedInfo);
      setExistingClientData(null);
    }
  };

  // BÚSQUEDA ROBUSTA DE DIRECCIONES (Compatible con Web y CORS)
  const searchAddress = async (text: string) => {
    setAddressInput(text);
    setIsValidated(false);
    setValidatedAddress(null);

    if (!text || text.trim().length < 3) {
      setAddressSuggestions([]);
      return;
    }

    setIsValidating(true);
    try {
      const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(text)}&limit=6&lat=40.4168&lon=-3.7038`;
      const res = await fetch(photonUrl);
      const data = await res.json();
      
      if (data && data.features && data.features.length > 0) {
        const results = data.features.map((f: any) => {
          const p = f.properties || {};
          const street = p.street || p.name || '';
          const num = p.housenumber ? `, ${p.housenumber}` : '';
          const city = p.city || p.town || p.district || p.county || 'Madrid';
          const postcode = p.postcode ? ` (${p.postcode})` : '';
          const state = p.state || p.country || '';

          return {
            title: `${street}${num}`.trim() || p.name,
            subtitle: `🏛️ ${city}${postcode} · ${state}`,
            fullFormatted: `${street}${num}, ${city}${postcode}`.trim()
          };
        });
        setAddressSuggestions(results);
        return;
      }
    } catch (error) {
      console.log('Error buscando sugerencias:', error);
    } finally {
      setIsValidating(false);
    }
  };

  const selectSuggestion = (item: any) => {
    const chosen = item.fullFormatted || item.title;
    setAddressInput(chosen);
    setValidatedAddress(chosen);
    setIsValidated(true);
    setAddressSuggestions([]);
  };

  const confirmCurrentAddress = () => {
    if (!addressInput || addressInput.trim().length < 4) {
      alert("Introduce al menos la calle, número y población.");
      return;
    }
    setValidatedAddress(addressInput.trim());
    setIsValidated(true);
    setAddressSuggestions([]);
  };

  const verifyInGoogleMaps = () => {
    if (!addressInput.trim()) {
      alert('Escribe una dirección primero.');
      return;
    }
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressInput)}`);
  };

  const handleSelectService = (srv: any) => {
    setSelectedService(srv);
    if (srv.price && !price) {
      setPrice(srv.price);
    }
  };

  const checkSlotStatus = (testTime: string) => {
    if (!selectedService) return { conflict: false };
    const currentTeam = team || (teams[0]?.name ?? 'Equipo 1');
    const teamApps = existingAppointments.filter(a => (a.team || teams[0]?.name || 'Equipo 1') === currentTeam);

    const getMinutes = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const newStart = getMinutes(testTime);
    const newEnd = newStart + parseInt(selectedService.duration);
    for (const app of teamApps) {
      const existingStart = getMinutes(app.time);
      const existingEnd = existingStart + parseInt(app.duration);
      if (newStart < existingEnd && newEnd > existingStart) {
        return { conflict: true, reason: `⚠️ Solapamiento: Ya hay una cita de ${app.time} a ${Math.floor(existingEnd/60).toString().padStart(2,'0')}:${(existingEnd%60).toString().padStart(2,'0')}.` };
      }
    }
    return { conflict: false };
  };



  const saveAppointment = async () => {
    if (!client.trim() || !date || !time || !selectedService) {
      alert("Por favor, rellena los campos obligatorios (cliente, servicio, fecha y hora).");
      return;
    }

    const finalAddress = '';

    const status = checkSlotStatus(time);
    if (status.conflict) {
      alert(status.reason);
      return;
    }

    try {
      const finalTeam = team || (teams[0]?.name ?? 'Equipo 1');
      const cleanPhone = phone.trim();
      const cleanClient = client.trim();

      // 1. Guardar la cita
      await addDoc(collection(db, 'appointments'), {
        client: cleanClient,
        phone: cleanPhone,
        date,
        time,
        address: finalAddress,
        detailedInfo: detailedInfo.trim(),
        price: price.trim() || '',
        team: finalTeam,
        serviceName: selectedService.name,
        duration: selectedService.duration,
        createdAt: new Date()
      });

      // 2. Gestionar la ficha de Cliente (Crear nuevo o Actualizar existente)
      if (cleanPhone) {
        const qClient = query(collection(db, 'clients'), where('phone', '==', cleanPhone));
        const snap = await getDocs(qClient);

        if (!snap.empty) {
          // Cliente existente: actualizar datos si cambiaron
          const existingDoc = snap.docs[0];
          await updateDoc(doc(db, 'clients', existingDoc.id), {
            name: cleanClient,
            address: finalAddress,
            detailedInfo: detailedInfo.trim(),
            lastServiceDate: date,
            updatedAt: new Date()
          });
        } else {
          // Cliente nuevo: registrar en cartera de clientes
          await addDoc(collection(db, 'clients'), {
            name: cleanClient,
            phone: cleanPhone,
            address: finalAddress,
            detailedInfo: detailedInfo.trim(),
            createdAt: new Date(),
            lastServiceDate: date
          });
        }
      }

      // Resetear estado
      setClient('');
      setPhone('');
      setExistingClientData(null);
      setTime('');
      setAddressInput('');
      setValidatedAddress(null);
      setDetailedInfo('');
      setIsValidated(false);
      setPrice('');
      setSelectedService(null);
      setSmartSuggestion(null);
      navigation.navigate('Calendar');
    } catch (error) {
      alert("Error al guardar la cita.");
    }
  };

  const timeSlots = [];
  for (let h = 9; h <= 20; h++) {
    for (let m = 0; m < 60; m += 15) {
      if (h === 20 && m > 0) continue; 
      timeSlots.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    }
  }

  const activeTeamsList = teams.length > 0 ? teams.map(t => t.name) : ['Equipo 1', 'Equipo 2'];

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Programar Nueva Cita</Text>
      
      {/* TELÉFONO Y DETECCIÓN AUTOMÁTICA DE CLIENTE */}
      <View style={{ marginBottom: 12 }}>
        <Text style={styles.inputLabel}>Teléfono de contacto del cliente:</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej: 612 345 678"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={handlePhoneChange}
        />
        {existingClientData && (
          <View style={styles.existingClientBox}>
            <Text style={styles.existingClientText}>
              ⭐ ¡Cliente habitual encontrado! ({existingClientData.name})
            </Text>
            <TouchableOpacity style={styles.autofillBtn} onPress={autofillClient}>
              <Text style={styles.autofillBtnText}>⚡ Autocompletar datos del cliente</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* NOMBRE DEL CLIENTE */}
      <View style={{ marginBottom: 12 }}>
        <Text style={styles.inputLabel}>Nombre del cliente: *</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej: Laura García"
          value={client}
          onChangeText={setClient}
        />
      </View>
      


      <Text style={styles.subtitle}>1. Servicio:</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollRow}>
        {services.map(srv => (
          <TouchableOpacity 
            key={srv.id} 
            style={[styles.chipBtn, selectedService?.id === srv.id && styles.chipSelected]}
            onPress={() => handleSelectService(srv)}
          >
            <Text style={selectedService?.id === srv.id ? styles.textSelected : styles.textUnselected}>
              {srv.name} (⏱ {srv.duration}m{srv.price ? ` · 💶 ${srv.price}€` : ''})
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>



      <Text style={styles.subtitle}>2. Equipo Asignado:</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollRow}>
        {activeTeamsList.map(t => (
          <TouchableOpacity key={t} style={[styles.chipBtn, (team || activeTeamsList[0]) === t && styles.chipSelected]} onPress={() => setTeam(t)}>
            <Text style={(team || activeTeamsList[0]) === t ? styles.textSelected : styles.textUnselected}>🚐 {t}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.subtitle}>3. Día y Hora:</Text>
      <TouchableOpacity style={styles.dropdownBtn} onPress={() => setShowCalendar(!showCalendar)}>
        <Text style={styles.dropdownText}>📅 {date} {showCalendar ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      
      {showCalendar && (
        <View style={styles.calendarContainer}>
          <Calendar
            onDayPress={(day: any) => { setDate(day.dateString); setShowCalendar(false); }}
            markedDates={{ [date]: { selected: true, selectedColor: '#D48A9A' } }}
            theme={{ todayTextColor: '#7A4B56', arrowColor: '#7A4B56' }}
          />
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollRow}>
        {timeSlots.map(t => {
          const status = checkSlotStatus(t);
          const isConflict = selectedService ? status.conflict : false;
          let chipStyle: any = styles.chipBtn; let textStyle: any = styles.textUnselected;
          if (time === t) { chipStyle = styles.chipSelected; textStyle = styles.textSelected; } 
          else if (selectedService) {
             if (isConflict) { chipStyle = styles.chipConflict; textStyle = styles.textConflict; } 
             else { chipStyle = styles.chipAvailable; textStyle = styles.textAvailable; }
          }
          return (
            <TouchableOpacity key={t} style={chipStyle} onPress={() => { if (isConflict) alert(status.reason); setTime(t); }}>
              <Text style={textStyle}>{t}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.navigate('Calendar')}><Text style={styles.cancelButtonText}>Cancelar</Text></TouchableOpacity>
        <TouchableOpacity style={styles.saveButton} onPress={saveAppointment}><Text style={styles.saveButtonText}>Guardar Cita</Text></TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f9f9f9' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 15, color: '#7A4B56' },
  subtitle: { fontSize: 16, fontWeight: 'bold', marginTop: 10, marginBottom: 10, color: '#7A4B56' },
  inputLabel: { fontSize: 13, fontWeight: 'bold', color: '#7A4B56', marginBottom: 4 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 8, fontSize: 15 },
  inputValidated: { borderColor: '#D48A9A', borderWidth: 2, backgroundColor: '#fafffa' },
  
  existingClientBox: {
    backgroundColor: '#e8f4fd',
    borderWidth: 1,
    borderColor: '#b6daf7',
    padding: 10,
    borderRadius: 8,
    marginTop: 6
  },
  existingClientText: { color: '#0c5460', fontWeight: 'bold', fontSize: 13, marginBottom: 6 },
  autofillBtn: { backgroundColor: '#7A4B56', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, alignItems: 'center' },
  autofillBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },

  // Validación de Dirección
  addressSection: { marginBottom: 12 },
  addressInputRow: { flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 6 },
  validateBtn: { backgroundColor: '#D48A9A', paddingHorizontal: 12, paddingVertical: 12, borderRadius: 8, justifyContent: 'center' },
  validateBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 },
  mapsVerifyBtn: { backgroundColor: '#F9F1F3', borderWidth: 1, borderColor: '#7A4B56', paddingHorizontal: 10, paddingVertical: 12, borderRadius: 8, justifyContent: 'center' },
  mapsVerifyText: { color: '#7A4B56', fontWeight: 'bold', fontSize: 13 },
  validatingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 4 },
  validatingText: { color: '#666', fontSize: 12, fontStyle: 'italic' },
  suggestionsCard: { backgroundColor: '#ffffff', borderRadius: 8, borderWidth: 1, borderColor: '#E8CED4', marginTop: 4, elevation: 4, shadowOpacity: 0.15 },
  suggestionsHeader: { backgroundColor: '#f0f6fc', paddingHorizontal: 12, paddingVertical: 8, fontWeight: 'bold', color: '#7A4B56', fontSize: 12, borderTopLeftRadius: 7, borderTopRightRadius: 7 },
  suggestionItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  suggestionItemTitle: { fontWeight: 'bold', color: '#7A4B56', fontSize: 14 },
  suggestionItemSubtitle: { color: '#555', fontSize: 12, marginTop: 2 },
  validatedBadge: { backgroundColor: '#FFF5F7', borderWidth: 1, borderColor: '#a3d9a3', padding: 8, borderRadius: 6, marginTop: 4 },
  validatedBadgeText: { color: '#7A4B56', fontWeight: 'bold', fontSize: 12 },

  smartButton: { backgroundColor: '#7A4B56', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 15 },
  smartButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  suggestionBox: { backgroundColor: '#e3f2fd', padding: 15, borderRadius: 8, borderWidth: 1, borderColor: '#90caf9', marginBottom: 15 },
  suggestionText: { color: '#0d47a1', fontSize: 14, marginBottom: 10, lineHeight: 20 },
  applyBtn: { backgroundColor: '#1976d2', padding: 10, borderRadius: 6, alignItems: 'center' },
  applyBtnText: { color: '#fff', fontWeight: 'bold' },
  scrollRow: { flexGrow: 0, marginBottom: 15 },
  chipBtn: { paddingVertical: 10, paddingHorizontal: 15, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 20, marginRight: 10, justifyContent: 'center' },
  chipSelected: { paddingVertical: 10, paddingHorizontal: 15, backgroundColor: '#7A4B56', borderWidth: 1, borderColor: '#7A4B56', borderRadius: 20, marginRight: 10, justifyContent: 'center' },
  textSelected: { color: '#fff', fontWeight: 'bold' },
  textUnselected: { color: '#333' },
  chipAvailable: { paddingVertical: 10, paddingHorizontal: 15, backgroundColor: '#FFF5F7', borderWidth: 1, borderColor: '#D48A9A', borderRadius: 20, marginRight: 10, justifyContent: 'center' },
  textAvailable: { color: '#D48A9A', fontWeight: 'bold' },
  chipConflict: { paddingVertical: 10, paddingHorizontal: 15, backgroundColor: '#ffe5e5', borderWidth: 1, borderColor: '#d9534f', borderRadius: 20, marginRight: 10, justifyContent: 'center', opacity: 0.8 },
  textConflict: { color: '#d9534f', textDecorationLine: 'line-through' },
  dropdownBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', padding: 15, borderRadius: 8, marginBottom: 10, alignItems: 'center' },
  dropdownText: { color: '#7A4B56', fontWeight: 'bold', fontSize: 16 },
  calendarContainer: { borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#ddd', marginBottom: 10 },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15, marginBottom: 40 },
  saveButton: { backgroundColor: '#D48A9A', padding: 15, borderRadius: 8, alignItems: 'center', flex: 1, marginLeft: 10 },
  saveButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  cancelButton: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d9534f', padding: 15, borderRadius: 8, alignItems: 'center', flex: 1, marginRight: 10 },
  cancelButtonText: { color: '#d9534f', fontWeight: 'bold', fontSize: 16 }
});
