import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, ActivityIndicator, ScrollView } from 'react-native';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, increment } from 'firebase/firestore';
import { db } from '../config/firebase';

interface InventoryItem {
  id: string;
  name: string;
  category: 'maquinaria' | 'productos' | 'otros';
  team: string;
  stock?: number;
  minStockAlert?: number;
  totalHours?: number;
  createdAt: any;
}

export default function InventoryScreen({ route }: any) {
  const { role, teamName } = route?.params || { role: 'admin', teamName: null };
  const isAdmin = role === 'admin';

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form state
  const [name, setName] = useState('');
  const [minStock, setMinStock] = useState('2');
  const [category, setCategory] = useState<'maquinaria' | 'productos' | 'otros'>('productos');
  const [selectedTeam, setSelectedTeam] = useState('Oficina/General');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'maquinaria' | 'productos' | 'otros'>('productos');

  useEffect(() => {
    const q = query(collection(db, 'inventory'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: InventoryItem[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as InventoryItem);
      });
      setItems(list);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

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

  const handleEdit = (item: InventoryItem) => {
    setEditingId(item.id);
    setName(item.name);
    setMinStock(item.minStockAlert?.toString() ?? '2');
    setSelectedTeam(item.team || 'Oficina/General');
    setActiveTab(item.category);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setName('');
    setMinStock('2');
    setSelectedTeam('Oficina/General');
  };

  const saveItem = async () => {
    if (name.trim() === '') {
      alert('Por favor, introduce el nombre del artículo.');
      return;
    }
    
    let parsedMinStock = 2;
    if (activeTab !== 'maquinaria') {
      parsedMinStock = parseInt(minStock);
      if (isNaN(parsedMinStock)) parsedMinStock = 2;
    }

    try {
      if (editingId) {
        await updateDoc(doc(db, 'inventory', editingId), {
          name: name.trim(),
          category: activeTab,
          team: selectedTeam,
          ...(activeTab !== 'maquinaria' && { minStockAlert: parsedMinStock })
        });
      } else {
        const newItem = {
          name: name.trim(),
          category: activeTab,
          team: selectedTeam,
          createdAt: new Date(),
          ...(activeTab === 'maquinaria' ? { totalHours: 0 } : { stock: 0, minStockAlert: parsedMinStock })
        };
        await addDoc(collection(db, 'inventory'), newItem);
      }
      cancelEdit();
    } catch (error) {
      alert('Error al guardar el artículo.');
    }
  };

  const deleteItem = async (id: string, itemName: string) => {
    if (window.confirm(`¿Seguro que deseas eliminar "${itemName}" del inventario?`)) {
      try {
        await deleteDoc(doc(db, 'inventory', id));
      } catch (error) {
        alert('Error al eliminar.');
      }
    }
  };

  const adjustStock = async (id: string, amount: number) => {
    try {
      await updateDoc(doc(db, 'inventory', id), {
        stock: increment(amount)
      });
    } catch (error) {
      alert('Error al actualizar el stock.');
    }
  };

  const addHours = async (id: string) => {
    const hours = window.prompt('¿Cuántas horas de uso deseas añadir?');
    if (hours && !isNaN(Number(hours))) {
      try {
        await updateDoc(doc(db, 'inventory', id), {
          totalHours: increment(Number(hours))
        });
      } catch (error) {
        alert('Error al actualizar las horas.');
      }
    }
  };

  const filteredItems = items.filter(i => i.category === activeTab);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>📦 Control de Inventario</Text>



      {/* Formulario de Alta / Edición (Solo Admin) */}
      {isAdmin && (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>{editingId ? '✏️ Editar Artículo' : 'Añadir Nuevo Artículo'}</Text>
          <View style={styles.formRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Nombre (ej. Limpiacristales 5L)"
              value={name}
              onChangeText={setName}
            />
            {activeTab !== 'maquinaria' && (
              <TextInput
                style={[styles.input, { width: 90 }]}
                placeholder="Alerta en..."
                keyboardType="numeric"
                value={minStock}
                onChangeText={setMinStock}
              />
            )}
          </View>

          <Text style={styles.label}>Asignar a Equipo (opcional):</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.teamScrollRow}>
            {['Oficina/General', ...teams.map(t => t.name)].map((tName) => (
              <TouchableOpacity
                key={tName}
                style={[styles.teamChip, selectedTeam === tName && styles.teamChipActive]}
                onPress={() => setSelectedTeam(tName)}
              >
                <Text style={selectedTeam === tName ? styles.teamChipTextActive : styles.teamChipTextInactive}>
                  {tName === 'Oficina/General' ? '🏢 General' : `🚐 ${tName}`}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity style={[styles.buttonAdd, { flex: 1 }]} onPress={saveItem}>
              <Text style={styles.buttonText}>{editingId ? 'Guardar Cambios' : `+ Registrar en ${activeTab}`}</Text>
            </TouchableOpacity>
            {editingId && (
              <TouchableOpacity style={[styles.buttonAdd, { flex: 1, backgroundColor: '#888' }]} onPress={cancelEdit}>
                <Text style={styles.buttonText}>Cancelar</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Lista de Inventario */}
      {loading ? (
        <ActivityIndicator size="large" color="#002a54" />
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isAlert = item.category !== 'maquinaria' && item.stock !== undefined && item.stock <= (item.minStockAlert ?? 2);
            return (
              <View style={[styles.itemCard, isAlert ? styles.itemCardAlert : null]}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemTeam}>{item.team === 'Oficina/General' ? '🏢 General' : `🚐 ${item.team}`}</Text>
                  
                  {item.category === 'maquinaria' ? (
                    <Text style={styles.itemStat}>Uso acumulado: <Text style={{fontWeight:'bold', color:'#002a54'}}>{item.totalHours || 0} horas</Text></Text>
                  ) : (
                    <Text style={[styles.itemStat, isAlert && {color: '#d9534f', fontWeight: 'bold'}]}>
                      Stock actual: <Text style={{fontWeight:'bold'}}>{item.stock || 0} u.</Text>
                      {isAdmin && <Text style={{fontSize: 10, color: '#999', fontWeight: 'normal'}}> (Avisa en {item.minStockAlert ?? 2})</Text>}
                    </Text>
                  )}
                </View>
                
                <View style={styles.itemActions}>
                  {item.category === 'maquinaria' ? (
                    <TouchableOpacity style={styles.actionBtnBlue} onPress={() => addHours(item.id)}>
                      <Text style={styles.actionBtnText}>+ Horas</Text>
                    </TouchableOpacity>
                  ) : (
                    <>
                      <TouchableOpacity style={styles.actionBtnRed} onPress={() => adjustStock(item.id, -1)}>
                        <Text style={styles.actionBtnText}>- 1 Gasto</Text>
                      </TouchableOpacity>
                      {isAdmin && (
                        <TouchableOpacity style={styles.actionBtnGreen} onPress={() => adjustStock(item.id, 1)}>
                          <Text style={styles.actionBtnText}>+ Stock</Text>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                  {isAdmin && (
                    <>
                      <TouchableOpacity style={styles.iconBtn} onPress={() => handleEdit(item)}>
                        <Text style={{fontSize: 16}}>✏️</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.iconBtn} onPress={() => deleteItem(item.id, item.name)}>
                        <Text style={{fontSize: 16}}>🗑️</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            );
          }}
          ListEmptyComponent={<Text style={styles.empty}>No hay artículos en esta categoría.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f9f9f9' },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, color: '#002a54' },
  tabsContainer: { flexDirection: 'row', marginBottom: 15, backgroundColor: '#fff', borderRadius: 8, padding: 4, elevation: 1 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 6 },
  tabActive: { backgroundColor: '#eef4fa' },
  tabText: { color: '#555', fontWeight: '600' },
  tabTextActive: { color: '#002a54', fontWeight: 'bold' },
  
  formCard: { backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 20, elevation: 1 },
  formTitle: { fontSize: 14, fontWeight: 'bold', color: '#555', marginBottom: 10 },
  formRow: { marginBottom: 10 },
  input: { backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 8, fontSize: 15 },
  label: { fontSize: 12, fontWeight: 'bold', color: '#555', marginBottom: 6, marginTop: 4 },
  teamScrollRow: { marginBottom: 15, maxHeight: 40 },
  teamChip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#f9f9f9', marginRight: 8, height: 35, justifyContent: 'center' },
  teamChipActive: { backgroundColor: '#002a54', borderColor: '#002a54' },
  teamChipTextActive: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  teamChipTextInactive: { color: '#555', fontSize: 12 },
  
  buttonAdd: { backgroundColor: '#002a54', padding: 12, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  
  itemCard: { backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderLeftWidth: 4, borderLeftColor: '#4a9b40', elevation: 1 },
  itemCardAlert: { borderLeftColor: '#d9534f', backgroundColor: '#fffafa' },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 2 },
  itemTeam: { fontSize: 12, color: '#777', marginBottom: 6, fontStyle: 'italic' },
  itemStat: { fontSize: 13, color: '#555' },
  
  itemActions: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  actionBtnGreen: { backgroundColor: '#eafaf1', borderWidth: 1, borderColor: '#2ecc71', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6 },
  actionBtnRed: { backgroundColor: '#fdedec', borderWidth: 1, borderColor: '#e74c3c', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6 },
  actionBtnBlue: { backgroundColor: '#eaf4ff', borderWidth: 1, borderColor: '#3498db', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6 },
  actionBtnText: { fontSize: 12, fontWeight: 'bold', color: '#333' },
  iconBtn: { padding: 4, marginLeft: 4 },
  empty: { color: '#888', fontStyle: 'italic', textAlign: 'center', marginTop: 20 }
});
