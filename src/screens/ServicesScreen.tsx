import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query } from 'firebase/firestore';
import { db } from '../config/firebase';

interface Service {
  id: string;
  name: string;
  duration: string;
  price?: string;
}

export default function ServicesScreen() {
  const [services, setServices] = useState<Service[]>([]);
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('');
  const [price, setPrice] = useState('');
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
    return () => unsubscribe();
  }, []);

  const saveService = async () => {
    if (name.trim() === '' || duration.trim() === '') {
      alert('Por favor, completa el nombre y la duración en minutos.');
      return;
    }

    try {
      const serviceData: any = {
        name: name.trim(),
        duration: duration.trim(),
        price: price.trim() || ''
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
    } catch (error) {
      alert('Hubo un error al guardar el servicio.');
    }
  };

  const startEdit = (item: Service) => {
    setEditingId(item.id);
    setName(item.name);
    setDuration(item.duration);
    setPrice(item.price || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setName('');
    setDuration('');
    setPrice('');
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

  return (
    <View style={styles.container}>
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
      
      <View style={styles.actionRow}>
        {editingId && (
          <TouchableOpacity style={styles.cancelBtn} onPress={cancelEdit}>
            <Text style={styles.cancelBtnText}>Cancelar</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.button, editingId ? styles.buttonEdit : styles.buttonAdd]}
          onPress={saveService}
        >
          <Text style={styles.buttonText}>
            {editingId ? 'Guardar Cambios' : 'Añadir Servicio'}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.titleList}>Servicios Disponibles ({services.length})</Text>
      {loading ? (
        <ActivityIndicator size="large" color="#4a9b40" />
      ) : (
        <FlatList
          data={services}
          keyExtractor={(item) => item.id}
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
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, color: '#002a54' },
  titleList: { fontSize: 18, fontWeight: 'bold', marginTop: 25, marginBottom: 15, color: '#002a54' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 8, marginBottom: 12, fontSize: 15 },
  actionRow: { flexDirection: 'row', gap: 10 },
  button: { flex: 1, padding: 14, borderRadius: 8, alignItems: 'center' },
  buttonAdd: { backgroundColor: '#4a9b40' },
  buttonEdit: { backgroundColor: '#002a54' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  cancelBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d9534f', padding: 14, borderRadius: 8, alignItems: 'center', width: 100 },
  cancelBtnText: { color: '#d9534f', fontWeight: 'bold', fontSize: 15 },
  serviceCard: { backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 1, borderWidth: 1, borderColor: '#e0e0e0' },
  serviceCardEditing: { borderColor: '#002a54', borderWidth: 2, backgroundColor: '#f0f7ff' },
  serviceInfo: { flex: 1 },
  serviceName: { fontSize: 16, fontWeight: 'bold', color: '#002a54', marginBottom: 4 },
  badgeRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  serviceDuration: { color: '#4a9b40', fontWeight: 'bold', fontSize: 14 },
  servicePrice: { color: '#002a54', fontWeight: 'bold', fontSize: 14, backgroundColor: '#eef4fa', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  cardActions: { flexDirection: 'row', gap: 8 },
  iconBtn: { padding: 8, borderRadius: 6, backgroundColor: '#f0f4f8' },
  actionIcon: { fontSize: 16 },
  empty: { color: '#888', fontStyle: 'italic', textAlign: 'center', marginTop: 20 }
});
