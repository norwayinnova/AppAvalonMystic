import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query } from 'firebase/firestore';
import { db } from '../config/firebase';

interface Service {
  id: string;
  name: string;
  duration: string;
  price?: string;
  allowedTeams?: string[];
}

export default function ServicesScreen() {
  const [services, setServices] = useState<Service[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('');
  const [price, setPrice] = useState('');
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'services'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const servicesList: Service[] = [];
      snapshot.forEach((docSnap) => {
        servicesList.push({ id: docSnap.id, ...docSnap.data() } as Service);
      });
      setServices(servicesList);
      setLoading(false);
    }, (error) => {
      console.error(error);
      setLoading(false);
    });

    const qTeams = query(collection(db, 'teams'));
    const unTeams = onSnapshot(qTeams, snap => {
      const tList: any[] = [];
      snap.forEach(d => tList.push({ id: d.id, ...d.data() }));
      setTeams(tList);
    });

    return () => { unsubscribe(); unTeams(); };
  }, []);

  const saveService = async () => {
    if (name.trim() === '' || duration.trim() === '') {
      alert('Por favor, completa el nombre y la duración en minutos.');
      return;
    }
    if (selectedTeams.length === 0) {
      alert('Selecciona al menos una empleada que realice este servicio.');
      return;
    }

    try {
      const serviceData: any = {
        name: name.trim(),
        duration: duration.trim(),
        price: price.trim() || '',
        allowedTeams: selectedTeams
      };

      if (editingId) {
        await updateDoc(doc(db, 'services', editingId), {
          ...serviceData,
          updatedAt: new Date()
        });
        setEditingId(null);
      } else {
        await addDoc(collection(db, 'services'), {
          ...serviceData,
          createdAt: new Date()
        });
      }
      setName('');
      setDuration('');
      setPrice('');
      setSelectedTeams([]);
    } catch (error) {
      alert('Hubo un error al guardar el servicio.');
    }
  };

  const startEdit = (item: Service) => {
    setEditingId(item.id);
    setName(item.name);
    setDuration(item.duration);
    setPrice(item.price || '');
    setSelectedTeams(item.allowedTeams || []);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setName('');
    setDuration('');
    setPrice('');
    setSelectedTeams([]);
  };

  const deleteService = async (id: string, serviceName: string) => {
    if (window.confirm(`¿Seguro que deseas eliminar el servicio "${serviceName}"?`)) {
      try {
        await deleteDoc(doc(db, 'services', id));
        if (editingId === id) {
          cancelEdit();
        }
      } catch (error) {
        alert('Hubo un error al eliminar el servicio.');
      }
    }
  };

  const renderForm = () => (
    <View style={{ marginBottom: 20 }}>
      <Text style={styles.title}>
        {editingId ? '✏️ Modificar Servicio' : '➕ Nuevo Servicio'}
      </Text>
      
      <TextInput
        style={styles.input}
        placeholder="Nombre (ej. Limpieza Sofá 3 plazas)"
        value={name}
        onChangeText={setName}
      />
      <TextInput
        style={styles.input}
        placeholder="Duración estimada en minutos (ej. 90)"
        keyboardType="numeric"
        value={duration}
        onChangeText={setDuration}
      />
      <TextInput
        style={styles.input}
        placeholder="Presupuesto base orientativo (€) (opcional)"
        keyboardType="numeric"
        value={price}
        onChangeText={setPrice}
      />

      <View style={{ marginBottom: 15 }}>
        <Text style={{ fontWeight: 'bold', color: '#7A4B56', marginBottom: 5 }}>¿Qué empleadas realizan este servicio?</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {teams.map(t => {
            const isSelected = selectedTeams.includes(t.name);
            return (
              <TouchableOpacity 
                key={t.id} 
                style={[styles.chip, isSelected && styles.chipSelected]}
                onPress={() => {
                  if (isSelected) {
                    setSelectedTeams(selectedTeams.filter(name => name !== t.name));
                  } else {
                    setSelectedTeams([...selectedTeams, t.name]);
                  }
                }}
              >
                <Text style={isSelected ? styles.chipTextSelected : styles.chipTextUnselected}>
                  {isSelected ? '✓ ' : ''}{t.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity 
          style={[styles.button, editingId ? styles.buttonEdit : styles.buttonAdd]} 
          onPress={saveService}
        >
          <Text style={styles.buttonText}>{editingId ? 'Guardar Cambios' : 'Añadir Servicio'}</Text>
        </TouchableOpacity>
        
        {editingId && (
          <TouchableOpacity style={styles.cancelBtn} onPress={cancelEdit}>
            <Text style={styles.cancelBtnText}>Cancelar</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.titleList}>Servicios Disponibles ({services.length})</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color="#D48A9A" />
      ) : (
        <FlatList
          data={services}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderForm}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={[styles.serviceCard, editingId === item.id && styles.serviceCardEditing]}>
              <View style={styles.serviceInfo}>
                <Text style={styles.serviceName}>{item.name}</Text>
                <View style={styles.badgeRow}>
                  <Text style={styles.serviceDuration}>⏱ {item.duration} min</Text>
                  {item.price ? <Text style={styles.servicePrice}>💶 {item.price} €</Text> : null}
                </View>
              </View>
              <View style={styles.cardActions}>
                <TouchableOpacity style={styles.iconBtn} onPress={() => startEdit(item)}>
                  <Text style={styles.actionIcon}>✏️</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} onPress={() => deleteService(item.id, item.name)}>
                  <Text style={styles.actionIcon}>🗑️</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>Aún no has añadido ningún servicio.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f9f9f9' },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, color: '#7A4B56' },
  titleList: { fontSize: 18, fontWeight: 'bold', marginTop: 25, marginBottom: 15, color: '#7A4B56' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 8, marginBottom: 12, fontSize: 15 },
  actionRow: { flexDirection: 'row', gap: 10 },
  button: { flex: 1, padding: 14, borderRadius: 8, alignItems: 'center' },
  buttonAdd: { backgroundColor: '#D48A9A' },
  buttonEdit: { backgroundColor: '#7A4B56' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  cancelBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d9534f', padding: 14, borderRadius: 8, alignItems: 'center', width: 100 },
  cancelBtnText: { color: '#d9534f', fontWeight: 'bold', fontSize: 15 },
  serviceCard: { backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 1, borderWidth: 1, borderColor: '#e0e0e0' },
  serviceCardEditing: { borderColor: '#7A4B56', borderWidth: 2, backgroundColor: '#f0f7ff' },
  serviceInfo: { flex: 1 },
  serviceName: { fontSize: 16, fontWeight: 'bold', color: '#7A4B56', marginBottom: 4 },
  badgeRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  serviceDuration: { color: '#D48A9A', fontWeight: 'bold', fontSize: 14 },
  servicePrice: { color: '#7A4B56', fontWeight: 'bold', fontSize: 14, backgroundColor: '#F9F1F3', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  cardActions: { flexDirection: 'row', gap: 8 },
  iconBtn: { padding: 10, backgroundColor: '#FFF5F7', borderRadius: 8 },
  actionIcon: { fontSize: 16 },
  empty: { textAlign: 'center', marginTop: 30, color: '#aaa', fontStyle: 'italic' },
  chip: { paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 20 },
  chipSelected: { backgroundColor: '#FFF5F7', borderColor: '#D48A9A' },
  chipTextUnselected: { color: '#555' },
  chipTextSelected: { color: '#D48A9A', fontWeight: 'bold' }
});
