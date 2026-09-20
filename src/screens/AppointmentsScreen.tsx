import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Linking
} from 'react-native';
import { collection, addDoc, updateDoc, doc, onSnapshot, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { Calendar } from 'react-native-calendars';
import { db } from '../config/firebase';

export default function AppointmentsScreen({ route, navigation }: any) {
  const { role, teamName, selectedDate, selectedTime } = route?.params || { role: 'admin', teamName: null };
  const isAdmin = role === 'admin' || role === 'management';

  const [client, setClient] = useState('');
  const [phone, setPhone] = useState('');
  const [existingClientData, setExistingClientData] = useState<any>(null);

  const [date, setDate] = useState(selectedDate || new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState(selectedTime || '');
  const [isFullDayBlock, setIsFullDayBlock] = useState(false);
  const [customDuration, setCustomDuration] = useState('');
  
  // Dirección y validación optimizada
  const [addressInput, setAddressInput] = useState('');
  const [validatedAddress, setValidatedAddress] = useState<string | null>(null);
  const [detailedInfo, setDetailedInfo] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [isValidated, setIsValidated] = useState(false);

  const [price, setPrice] = useState('');
  const [team, setTeam] = useState(teamName || 'Equipo 1');
  const [teams, setTeams] = useState<any[]>([]);
  const [showCalendar, setShowCalendar] = useState(false);
  
  const [services, setServices] = useState<any[]>([]);
  const [selectedServices, setSelectedServices] = useState<any[]>([]);
  
  const [existingAppointments, setExistingAppointments] = useState<any[]>([]);
  const [smartSuggestion, setSmartSuggestion] = useState<any>(null);
  const [serviceSearch, setServiceSearch] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  
  const [allClients, setAllClients] = useState<any[]>([]);
  const [clientSuggestions, setClientSuggestions] = useState<any[]>([]);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);

  const [serviceTeamAssignments, setServiceTeamAssignments] = useState<Record<string, string>>({});

  const moveServiceUp = (index: number) => {
    if (index === 0) return;
    const newServices = [...selectedServices];
    [newServices[index - 1], newServices[index]] = [newServices[index], newServices[index - 1]];
    setSelectedServices(newServices);
  };

  const moveServiceDown = (index: number) => {
    if (index === selectedServices.length - 1) return;
    const newServices = [...selectedServices];
    [newServices[index + 1], newServices[index]] = [newServices[index], newServices[index + 1]];
    setSelectedServices(newServices);
  };

  const [editingAppointmentId, setEditingAppointmentId] = useState<string | null>(null);

  // Actualizar estado si los params cambian
  useEffect(() => {
    if (route?.params?.selectedDate) setDate(route.params.selectedDate);
    if (route?.params?.selectedTime) setTime(route.params.selectedTime);
    if (route?.params?.teamName) setTeam(route.params.teamName);

    if (route?.params?.editAppointment) {
      const editData = route.params.editAppointment;
      setEditingAppointmentId(editData.id);
      setClient(editData.client || '');
      setPhone(editData.phone || '');
      setDate(editData.date || new Date().toISOString().split('T')[0]);
      setTime(editData.time || '');
      setTeam(editData.team || team);
      setAddressInput(editData.address || '');
      setDetailedInfo(editData.detailedInfo || '');
      setPrice(editData.price || '');
      
      // Attempt to restore selected service if it matches one in `services`
      // We will do this in another useEffect that depends on `services` loading
    }
  }, [route?.params]);

  // Restore selected services when services are loaded
  useEffect(() => {
    if (editingAppointmentId && services.length > 0 && route?.params?.editAppointment) {
      const editData = route.params.editAppointment;
      if (editData.serviceName === 'Bloqueo Completo') {
        setIsFullDayBlock(true);
      } else {
        const foundSrv = services.find(s => s.name === editData.serviceName);
        if (foundSrv && selectedServices.length === 0) {
          setSelectedServices([foundSrv]);
          setServiceTeamAssignments({ [foundSrv.id]: editData.team });
          if (editData.serviceName.toLowerCase().includes('bloquead') && editData.duration) {
            setCustomDuration(editData.duration.toString());
          }
        }
      }
    }
  }, [services, editingAppointmentId, route?.params]);

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

  // 1b. Cargar Clientes para Autocompletado
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'clients'), (snapshot) => {
      const clientsList: any[] = [];
      snapshot.forEach(docSnap => clientsList.push({ id: docSnap.id, ...docSnap.data() }));
      setAllClients(clientsList);
    });
    return () => unsubscribe();
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

  const [isTenthAppointment, setIsTenthAppointment] = useState(false);

  // BUSCADOR AUTOMÁTICO DE CLIENTES POR TELÉFONO
  const handlePhoneChange = async (text: string) => {
    setPhone(text);
    setIsTenthAppointment(false);
    
    // Autocomplete Logic
    if (text.length >= 3) {
      const matches = allClients.filter(c => c.phone?.includes(text));
      setClientSuggestions(matches.slice(0, 5)); // max 5 suggestions
      setShowClientSuggestions(matches.length > 0);
    } else {
      setShowClientSuggestions(false);
    }

    const cleanPhone = text.trim();
    if (cleanPhone.length >= 6) {
      try {
        const qClient = query(collection(db, 'clients'), where('phone', '==', cleanPhone));
        const snap = await getDocs(qClient);
        
        let clientFound: any = null;
        if (!snap.empty) {
          clientFound = { id: snap.docs[0].id, ...snap.docs[0].data() };
        } else {
          clientFound = { phone: cleanPhone };
        }

        // Buscar historial de citas en appointments (incluso si no está guardado en clients)
        const qApps = query(collection(db, 'appointments'), where('phone', '==', cleanPhone));
        const snapApps = await getDocs(qApps);
        
        let cancelledCount = 0;
        let completedCount = 0;
        snapApps.forEach(doc => {
           if (doc.data().status === 'cancelled') cancelledCount++;
           if (doc.data().status === 'completed') completedCount++;
        });

        if (cancelledCount >= 2) {
          clientFound.isProblematic = true;
        }
        
        if (completedCount === 9) {
          clientFound.isTenth = true;
          setIsTenthAppointment(true);
        }

        if (!snap.empty || cancelledCount > 0 || completedCount > 0) {
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

  const handleClientNameChange = (text: string) => {
    setClient(text);
    if (text.length >= 3) {
      const matches = allClients.filter(c => c.name?.toLowerCase().includes(text.toLowerCase()));
      setClientSuggestions(matches.slice(0, 5));
      setShowClientSuggestions(matches.length > 0);
    } else {
      setShowClientSuggestions(false);
    }
  };

  const selectClientSuggestion = (item: any) => {
    setClient(item.name || '');
    if (item.phone) {
      handlePhoneChange(item.phone); // Triggers the existing logic to check history
    }
    setShowClientSuggestions(false);
    
    // Autofill address if available
    if (item.address) {
      setAddressInput(item.address);
      setValidatedAddress(item.address);
      setIsValidated(true);
    }
    if (item.detailedInfo) {
      setDetailedInfo(item.detailedInfo);
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
    setSelectedServices(prev => {
      const isSelected = prev.find(s => s.id === srv.id);
      let newServices;
      if (isSelected) {
        newServices = prev.filter(s => s.id !== srv.id);
        setServiceTeamAssignments(prevAssign => {
          const newAssign = { ...prevAssign };
          delete newAssign[srv.id];
          return newAssign;
        });
      } else {
        newServices = [...prev, srv];
        setServiceTeamAssignments(prevAssign => {
          const allowed = srv.allowedTeams || [];
          let defaultTeam = team || (teams[0]?.name ?? 'Equipo 1');
          if (allowed.length > 0 && !allowed.includes(defaultTeam)) {
            defaultTeam = allowed[0]; // asigna a la primera que pueda si la actual no puede
          }
          return { ...prevAssign, [srv.id]: defaultTeam };
        });
      }
      
      const totalPrice = newServices.reduce((sum, s) => sum + (parseFloat(s.price) || 0), 0);
      setPrice(totalPrice > 0 ? totalPrice.toString() : '');
      
      return newServices;
    });
  };

  const getCombinedDuration = () => {
    if (selectedServices.length === 0) return 0;
    const isAnyBloqueo = selectedServices.some(s => s.name?.toLowerCase().includes('bloquead'));
    if (isAnyBloqueo && customDuration) {
      return parseInt(customDuration);
    }
    return selectedServices.reduce((sum, s) => sum + parseInt(s.duration || '0'), 0);
  };

  const checkSlotStatus = (testTime: string) => {
    if (selectedServices.length === 0) return { conflict: false };
    const currentTeam = team || (teams[0]?.name ?? 'Equipo 1');
    const teamApps = existingAppointments.filter(a => (a.team || teams[0]?.name || 'Equipo 1') === currentTeam && a.status !== 'cancelled' && a.id !== editingAppointmentId);

    const getMinutes = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const newStart = getMinutes(testTime);
    
    const durationToUse = getCombinedDuration();
    const newEnd = newStart + durationToUse;
    
    for (const app of teamApps) {
      const existingStart = getMinutes(app.time);
      const existingEnd = existingStart + parseInt(app.duration);
      
      const isBloqueo = app.serviceName.toLowerCase().includes('bloquead') || app.client.toLowerCase().includes('bloquead');

      if (newStart < existingEnd && newEnd > existingStart) {
        if (isBloqueo && newStart < existingStart) {
          continue;
        }
        return { conflict: true, reason: `⚠️ Solapamiento: Ya hay una cita de ${app.time} a ${Math.floor(existingEnd/60).toString().padStart(2,'0')}:${(existingEnd%60).toString().padStart(2,'0')}.` };
      }
    }
    return { conflict: false };
  };



  const saveAppointment = async () => {
    if (!client.trim() || !date || (!time && !isFullDayBlock) || (selectedServices.length === 0 && !isFullDayBlock)) {
      alert("Por favor, rellena los campos obligatorios (cliente, servicio, fecha y hora).");
      return;
    }

    const finalAddress = '';
    const finalTime = isFullDayBlock ? '09:00' : time;
    const finalDuration = isFullDayBlock ? '660' : getCombinedDuration().toString();

    // Comprobación de solapamientos secuencial
    if (!isFullDayBlock) {
      let currentStartTimeStr = finalTime;
      const getMinutes = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
      const minutesToTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2,'0')}:${String(m % 60).padStart(2,'0')}`;
      
      let currentMin = getMinutes(finalTime);

      for (const srv of selectedServices) {
        const srvTeam = serviceTeamAssignments[srv.id] || team || (teams[0]?.name ?? 'Equipo 1');
        const srvDur = srv.name?.toLowerCase().includes('bloquead') && customDuration ? parseInt(customDuration) : parseInt(srv.duration || '60');
        
        const teamApps = existingAppointments.filter(a => (a.team || teams[0]?.name || 'Equipo 1') === srvTeam && a.status !== 'cancelled' && a.id !== editingAppointmentId);
        const newStart = currentMin;
        const newEnd = currentMin + srvDur;

        for (const app of teamApps) {
          const existingStart = getMinutes(app.time);
          const existingEnd = existingStart + parseInt(app.duration);
          const isBloqueo = app.serviceName.toLowerCase().includes('bloquead') || app.client.toLowerCase().includes('bloquead');

          if (newStart < existingEnd && newEnd > existingStart) {
            if (isBloqueo && newStart < existingStart) continue;
            alert(`⚠️ Solapamiento en el servicio ${srv.name}: Ya hay una cita en el equipo ${srvTeam} de ${app.time} a ${minutesToTime(existingEnd)}.`);
            return;
          }
        }
        currentMin += srvDur;
      }
    }

    try {
      const cleanPhone = phone.trim();
      const cleanClient = client.trim();

      let finalNotes = route?.params?.editAppointment?.notes || '';
      if (isTenthAppointment && !finalNotes.includes('10ª Cita')) {
        finalNotes = finalNotes ? finalNotes + '\n🌟 10ª Cita - APLICAR 20% DESCUENTO' : '🌟 10ª Cita - APLICAR 20% DESCUENTO';
      }

      // Si estamos editando, borramos el documento original
      if (editingAppointmentId) {
        await deleteDoc(doc(db, 'appointments', editingAppointmentId));
      }

      // 1. Guardar las citas secuencialmente
      if (isFullDayBlock) {
        const finalTeam = team || (teams[0]?.name ?? 'Equipo 1');
        await addDoc(collection(db, 'appointments'), {
          client: cleanClient,
          phone: cleanPhone,
          date,
          time: finalTime,
          duration: finalDuration,
          serviceName: 'Bloqueo Completo',
          price: price,
          address: finalAddress,
          detailedInfo: detailedInfo.trim(),
          team: finalTeam,
          createdAt: new Date(),
          status: 'pending',
          notes: finalNotes
        });
      } else {
        const getMinutes = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
        const minutesToTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2,'0')}:${String(m % 60).padStart(2,'0')}`;
        let currentMin = getMinutes(finalTime);

        for (const srv of selectedServices) {
          const srvTeam = serviceTeamAssignments[srv.id] || team || (teams[0]?.name ?? 'Equipo 1');
          const srvDur = srv.name?.toLowerCase().includes('bloquead') && customDuration ? parseInt(customDuration) : parseInt(srv.duration || '60');
          
          await addDoc(collection(db, 'appointments'), {
            client: cleanClient,
            phone: cleanPhone,
            date,
            time: minutesToTime(currentMin),
            duration: srvDur.toString(),
            serviceName: srv.name,
            price: srv.price || '0',
            address: finalAddress,
            detailedInfo: detailedInfo.trim(),
            team: srvTeam,
            createdAt: new Date(),
            status: 'pending',
            notes: finalNotes
          });
          currentMin += srvDur;
        }
      }

      // 2. Gestionar la ficha de Cliente (Crear nuevo o Actualizar existente)
      try {
        if (cleanPhone) {
          const qClient = query(collection(db, 'clients'), where('phone', '==', cleanPhone));
          const snap = await getDocs(qClient);

          if (!snap.empty) {
            const existingDoc = snap.docs[0];
            await updateDoc(doc(db, 'clients', existingDoc.id), {
              name: cleanClient,
              address: finalAddress,
              detailedInfo: detailedInfo.trim(),
              lastServiceDate: date,
              updatedAt: new Date()
            });
          } else {
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
      } catch (clientErr) {
        console.warn("Aviso: La cita se creó, pero hubo un problema al actualizar la ficha del cliente.", clientErr);
      }

      // Resetear estado
      setClient('');
      setPhone('');
      setExistingClientData(null);
      setTime('');
      setIsFullDayBlock(false);
      setCustomDuration('');
      setAddressInput('');
      setValidatedAddress(null);
      setDetailedInfo('');
      setIsValidated(false);
      setPrice('');
      setSelectedServices([]);
      setServiceTeamAssignments({});
      setSmartSuggestion(null);
      setEditingAppointmentId(null);
      alert(editingAppointmentId ? "Cita actualizada correctamente" : "Cita creada correctamente");
      navigation.navigate('Calendar');
    } catch (error) {
      console.error("Detalle del error:", error);
      alert("Error al guardar la cita. Comprueba tu conexión.");
    }
  };

  const timeSlots = [];
  for (let h = 9; h <= 20; h++) {
    for (let m = 0; m < 60; m += 15) {
      if (h === 20 && m > 0) continue; 
      timeSlots.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    }
  }

  let activeTeamsList = teams.length > 0 ? teams.map(t => t.name) : ['Equipo 1', 'Equipo 2'];
  if (selectedServices.length > 0) {
    activeTeamsList = activeTeamsList.filter(t => selectedServices.every(s => !s.allowedTeams || s.allowedTeams.length === 0 || s.allowedTeams.includes(t)));
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{editingAppointmentId ? 'Editar Cita' : 'Programar Nueva Cita'}</Text>
      
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
        
        {/* Sugerencias de Autocompletado */}
        {showClientSuggestions && clientSuggestions.length > 0 && (
          <View style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, marginTop: 4, elevation: 2 }}>
            {clientSuggestions.map(s => (
              <TouchableOpacity 
                key={s.id} 
                style={{ padding: 10, borderBottomWidth: 1, borderBottomColor: '#eee' }}
                onPress={() => selectClientSuggestion(s)}
              >
                <Text style={{ fontWeight: 'bold' }}>{s.name || 'Sin nombre'}</Text>
                {s.phone ? <Text style={{ fontSize: 12, color: '#666' }}>📞 {s.phone}</Text> : null}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {existingClientData && (
          <View style={styles.existingClientBox}>
            <Text style={styles.existingClientText}>
              ⭐ ¡Cliente habitual encontrado! ({existingClientData.name})
            </Text>
            {existingClientData.isProblematic && (
              <Text style={{color: '#c0392b', fontWeight: 'bold', fontSize: 13, marginTop: 4, marginBottom: 8}}>
                ⚠️ ATENCIÓN: Esta clienta ha cancelado o no ha acudido a 2 o más citas. Se recomienda solicitar Pago de Reserva.
              </Text>
            )}
            {existingClientData.isTenth && (
              <Text style={{color: '#27ae60', fontWeight: 'bold', fontSize: 13, marginTop: 4, marginBottom: 8}}>
                🎁 PREMIO: ¡Ésta será la 10ª cita de la clienta! El sistema aplicará la etiqueta de descuento automáticamente.
              </Text>
            )}
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
          onChangeText={handleClientNameChange}
        />
        {client.toLowerCase().includes('bloquead') && (
          <TouchableOpacity 
            style={[styles.chipBtn, isFullDayBlock ? styles.chipSelected : {marginTop: 10}]} 
            onPress={() => setIsFullDayBlock(!isFullDayBlock)}
          >
            <Text style={isFullDayBlock ? styles.textSelected : styles.textUnselected}>
              {isFullDayBlock ? '☑️ Bloquear todo el día' : '☐ Bloquear todo el día'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      


      <Text style={styles.subtitle}>1. Servicio(s):</Text>
      <TouchableOpacity 
        style={styles.dropdownBtn} 
        onPress={() => {
          setCustomDuration(customDuration === 'show_services' ? '' : 'show_services');
        }}
      >
        <Text style={styles.dropdownText}>
          {selectedServices.length > 0 ? `✨ ${selectedServices.map(s => s.name).join(' + ')} (⏱ ${getCombinedDuration()}m)` : '▼ Seleccionar servicio(s)...'}
        </Text>
      </TouchableOpacity>

      {customDuration === 'show_services' && (
        <View style={styles.dropdownList}>
          <TextInput
            style={[styles.input, { marginBottom: 10, borderColor: '#D48A9A' }]}
            placeholder="🔍 Buscar servicio (ej. 'semip')"
            value={serviceSearch}
            onChangeText={setServiceSearch}
            autoFocus
          />
          {Object.entries(
            services
              .filter(s => s.name.toLowerCase().includes(serviceSearch.toLowerCase()))
              .reduce((acc: Record<string, any[]>, curr) => {
                const cat = curr.category || 'General';
                if (!acc[cat]) acc[cat] = [];
                acc[cat].push(curr);
                return acc;
              }, {})
          )
          .sort(([catA], [catB]) => catA.localeCompare(catB))
          .map(([categoryName, catServices]) => {
            const isExpanded = serviceSearch.length > 0 || expandedCategories[categoryName];
            return (
              <View key={categoryName} style={{ marginBottom: 10 }}>
                <TouchableOpacity 
                  onPress={() => setExpandedCategories(prev => ({ ...prev, [categoryName]: !prev[categoryName] }))}
                  style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f0f0f0', padding: 8, borderRadius: 5 }}
                >
                  <Text style={{ fontWeight: 'bold', color: '#333' }}>
                    📁 {categoryName} ({catServices.length})
                  </Text>
                  <Text style={{ color: '#666' }}>{isExpanded ? '▲' : '▼'}</Text>
                </TouchableOpacity>
                {isExpanded && catServices.map(srv => {
                  const isSelected = selectedServices.some(s => s.id === srv.id);
                  return (
                    <TouchableOpacity 
                      key={srv.id} 
                      style={[styles.dropdownItem, isSelected && styles.dropdownItemSelected, { paddingLeft: 15 }]}
                      onPress={() => {
                        handleSelectService(srv);
                        // Don't close the dropdown automatically so they can pick more
                      }}
                    >
                      <Text style={[styles.dropdownItemText, isSelected && styles.dropdownItemTextSelected]}>
                        {isSelected ? '✓ ' : '✨ '} {srv.name} (⏱ {srv.duration} min)
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          })}
          {services.filter(s => s.name.toLowerCase().includes(serviceSearch.toLowerCase())).length === 0 && (
            <Text style={{ textAlign: 'center', color: '#999', padding: 10 }}>No se encontraron servicios</Text>
          )}

          {/* Botón para cerrar el menú desplegable */}
          <TouchableOpacity 
            style={{ backgroundColor: '#D48A9A', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 10 }}
            onPress={() => setCustomDuration('')}
          >
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>Cerrar y Aceptar</Text>
          </TouchableOpacity>
        </View>
      )}

      {selectedServices.some(s => s.name?.toLowerCase().includes('bloquead')) && !isFullDayBlock && (
        <View style={{ marginBottom: 12, marginTop: 10 }}>
          <Text style={styles.inputLabel}>Duración del bloqueo (en minutos):</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: 90"
            keyboardType="numeric"
            value={customDuration !== 'show_services' && customDuration !== 'show_teams' ? customDuration : ''}
            onChangeText={setCustomDuration}
          />
        </View>
      )}

      {selectedServices.length > 0 && (
        <View style={{ marginTop: 20, marginBottom: 10 }}>
          <Text style={styles.subtitle}>2. Orden y Asignación de Servicios:</Text>
          <Text style={{fontSize: 12, color: '#666', marginBottom: 10}}>Si hay varios servicios, se programarán uno detrás de otro. Elige el orden y qué empleada hará cada uno.</Text>
          
          {selectedServices.map((srv, index) => {
            const srvTeam = serviceTeamAssignments[srv.id] || team || (teams[0]?.name ?? 'Equipo 1');
            const allowed = srv.allowedTeams || [];
            const availableTeamsForSrv = allowed.length > 0 ? teams.filter(t => allowed.includes(t.name)) : teams;

            return (
              <View key={srv.id} style={{ backgroundColor: '#f8fafc', padding: 10, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#e0e8f0' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontWeight: 'bold', flex: 1 }}>{index + 1}. {srv.name}</Text>
                  <View style={{ flexDirection: 'row', gap: 5 }}>
                    {index > 0 && (
                      <TouchableOpacity onPress={() => moveServiceUp(index)} style={{ padding: 4, backgroundColor: '#e0e8f0', borderRadius: 4 }}>
                        <Text>⬆️</Text>
                      </TouchableOpacity>
                    )}
                    {index < selectedServices.length - 1 && (
                      <TouchableOpacity onPress={() => moveServiceDown(index)} style={{ padding: 4, backgroundColor: '#e0e8f0', borderRadius: 4 }}>
                        <Text>⬇️</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {isAdmin ? (
                  <View style={{ marginTop: 8 }}>
                    <Text style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Asignado a:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {availableTeamsForSrv.map(t => (
                        <TouchableOpacity
                          key={t.name}
                          onPress={() => setServiceTeamAssignments(prev => ({...prev, [srv.id]: t.name}))}
                          style={{
                            paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginRight: 8,
                            backgroundColor: srvTeam === t.name ? '#D48A9A' : '#e0e8f0'
                          }}
                        >
                          <Text style={{ color: srvTeam === t.name ? '#fff' : '#333', fontSize: 12, fontWeight: srvTeam === t.name ? 'bold' : 'normal' }}>
                            {t.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                ) : (
                  <Text style={{ fontSize: 12, color: '#666', marginTop: 8 }}>Asignado a: {srvTeam}</Text>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Solo mostramos el equipo global por defecto si no hay servicios seleccionados */}
      {selectedServices.length === 0 && (
        <View style={{ marginTop: 20, marginBottom: 10 }}>
          {isAdmin ? (
            <>
              <Text style={styles.subtitle}>2. Equipo (Por defecto):</Text>
              <TouchableOpacity 
                style={styles.dropdownBtn} 
                onPress={() => setCustomDuration(customDuration === 'show_teams' ? '' : 'show_teams')}
              >
                <Text style={styles.dropdownText}>
                  {team ? `💇‍♀️ ${team}` : '▼ Seleccionar equipo...'}
                </Text>
              </TouchableOpacity>

              {customDuration === 'show_teams' && (
                <View style={styles.dropdownList}>
                  {teams.map(t => (
                    <TouchableOpacity 
                      key={t.id} 
                      style={[styles.dropdownItem, (team || teams[0]?.name) === t.name && styles.dropdownItemSelected]} 
                      onPress={() => { setTeam(t.name); setCustomDuration(''); }}
                    >
                      <Text style={(team || teams[0]?.name) === t.name ? styles.dropdownItemTextSelected : styles.dropdownItemText}>💇‍♀️ {t.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          ) : (
            <Text style={styles.subtitle}>2. Asignado a ti (💇‍♀️ {team})</Text>
          )}
        </View>
      )}

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

      {date && (
        <View style={{ marginTop: 10 }}>
          <Text style={styles.subtitle}>Hora de la cita:</Text>
          <TouchableOpacity 
            style={styles.dropdownBtn} 
            onPress={() => setCustomDuration(customDuration === 'show_times' ? '' : 'show_times')}
          >
            <Text style={styles.dropdownText}>
              {time ? `⏰ ${time}` : '▼ Seleccionar hora...'}
            </Text>
          </TouchableOpacity>

          {customDuration === 'show_times' && (
            <View style={[styles.dropdownList, {flexDirection: 'row', flexWrap: 'wrap', padding: 10}]}>
              {timeSlots.map(t => {
                const status = checkSlotStatus(t);
                const isConflict = selectedServices.length > 0 ? status.conflict : false;
                let chipStyle: any = styles.chipBtn; let textStyle: any = styles.textUnselected;
                if (time === t) { chipStyle = styles.chipSelected; textStyle = styles.textSelected; } 
                else if (selectedServices.length > 0) {
                   if (isConflict) { chipStyle = styles.chipConflict; textStyle = styles.textConflict; } 
                   else { chipStyle = styles.chipAvailable; textStyle = styles.textAvailable; }
                }
                return (
                  <TouchableOpacity key={t} style={chipStyle} onPress={() => { if (isConflict) alert(status.reason); else { setTime(t); setCustomDuration(''); } }}>
                    <Text style={textStyle}>{t}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      )}

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.navigate('Calendar')}><Text style={styles.cancelButtonText}>Cancelar</Text></TouchableOpacity>
        <TouchableOpacity style={styles.saveButton} onPress={saveAppointment}>
          <Text style={styles.saveButtonText}>Guardar Cita</Text>
        </TouchableOpacity>
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
  chipAvailable: { paddingVertical: 10, paddingHorizontal: 15, backgroundColor: '#e6f7e6', borderWidth: 1, borderColor: '#4a9b40', borderRadius: 20, marginRight: 10, justifyContent: 'center' },
  textAvailable: { color: '#4a9b40', fontWeight: 'bold' },
  chipConflict: { paddingVertical: 10, paddingHorizontal: 15, backgroundColor: '#ffe5e5', borderWidth: 1, borderColor: '#d9534f', borderRadius: 20, marginRight: 10, justifyContent: 'center', opacity: 0.8 },
  textConflict: { color: '#d9534f', textDecorationLine: 'line-through' },
  dropdownBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', padding: 15, borderRadius: 8, marginBottom: 10, alignItems: 'center' },
  dropdownText: { color: '#7A4B56', fontWeight: 'bold', fontSize: 16 },
  dropdownList: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee', borderRadius: 8, marginTop: 5, elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowOffset: {width: 0, height: 2} },
  dropdownItem: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  dropdownItemSelected: { backgroundColor: '#FFF5F7' },
  dropdownItemText: { fontSize: 15, color: '#333' },
  dropdownItemTextSelected: { fontSize: 15, color: '#D48A9A', fontWeight: 'bold' },
  timeSlot: { borderWidth: 1, borderColor: '#ccc', padding: 10, borderRadius: 8, margin: 5, width: '21%', alignItems: 'center' },
  timeSlotSelected: { backgroundColor: '#D48A9A', borderColor: '#D48A9A' },
  timeSlotText: { color: '#555' },
  timeSlotTextSelected: { color: '#fff', fontWeight: 'bold' },
  calendarContainer: { borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#ddd', marginBottom: 10 },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15, marginBottom: 40 },
  saveButton: { backgroundColor: '#D48A9A', padding: 15, borderRadius: 8, alignItems: 'center', flex: 1, marginLeft: 10 },
  saveButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  cancelButton: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d9534f', padding: 15, borderRadius: 8, alignItems: 'center', flex: 1, marginRight: 10 },
  cancelButtonText: { color: '#d9534f', fontWeight: 'bold', fontSize: 16 }
});
