import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import { collection, addDoc, onSnapshot, query, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';

export default function PromotionsScreen() {
  const [promotions, setPromotions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'promotions'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      const list: any[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setPromotions(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleSavePromo = async () => {
    if (!title.trim() || !message.trim()) {
      alert('Por favor, rellena el título y el mensaje de la promoción.');
      return;
    }
    try {
      await addDoc(collection(db, 'promotions'), {
        title: title.trim(),
        message: message.trim(),
        createdAt: new Date()
      });
      setTitle('');
      setMessage('');
      alert('Promoción guardada con éxito.');
    } catch (e) {
      alert('Error al guardar la promoción.');
    }
  };

  const handleDeletePromo = async (id: string) => {
    if (window.confirm('¿Seguro que quieres eliminar esta promoción del registro?')) {
      await deleteDoc(doc(db, 'promotions', id));
    }
  };

  const handleSendWhatsApp = (promoMessage: string) => {
    // Al no especificar número de teléfono, WhatsApp abre el menú de "Reenviar a..."
    // Lo cual es perfecto para seleccionar una Lista de Difusión.
    const url = `https://wa.me/?text=${encodeURIComponent(promoMessage)}`;
    Linking.openURL(url).catch(err => {
      alert('No se pudo abrir WhatsApp. Asegúrate de tenerlo instalado o usa WhatsApp Web.');
    });
  };

  if (loading) return <ActivityIndicator size="large" color="#D48A9A" style={{marginTop: 50}} />;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.mainTitle}>📢 Campañas y Promociones</Text>
        <Text style={styles.subtitle}>Redacta promociones y lánzalas por WhatsApp a tus clientas.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>✨ Crear Nueva Promoción</Text>
        
        <Text style={styles.label}>Título (Solo interno para ti):</Text>
        <TextInput 
          style={styles.input} 
          placeholder="Ej: San Valentín 20% Dto" 
          value={title} 
          onChangeText={setTitle} 
        />
        
        <Text style={styles.label}>Mensaje de WhatsApp a enviar:</Text>
        <TextInput 
          style={[styles.input, { height: 120, textAlignVertical: 'top' }]} 
          placeholder="Ej: ¡Hola! Este San Valentín en Avalon Mystic te regalamos..." 
          multiline
          numberOfLines={6}
          value={message} 
          onChangeText={setMessage} 
        />

        <TouchableOpacity style={styles.btnAction} onPress={handleSavePromo}>
          <Text style={styles.btnActionText}>💾 Guardar Promoción</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>🚀 Promociones Guardadas</Text>
        
        {promotions.length === 0 ? (
          <Text style={styles.noData}>No hay promociones guardadas todavía.</Text>
        ) : (
          promotions.map(promo => (
            <View key={promo.id} style={styles.promoItem}>
              <View style={styles.promoHeader}>
                <Text style={styles.promoTitle}>{promo.title}</Text>
                <TouchableOpacity onPress={() => handleDeletePromo(promo.id)}>
                  <Text style={styles.deleteText}>🗑️</Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.messageBox}>
                <Text style={styles.messageText}>{promo.message}</Text>
              </View>

              <TouchableOpacity style={styles.btnWhatsapp} onPress={() => handleSendWhatsApp(promo.message)}>
                <Text style={styles.btnWhatsappText}>📲 Enviar por WhatsApp (Difusión)</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      <View style={{height: 40}} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f4f7', padding: 15 },
  header: { marginBottom: 20 },
  mainTitle: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  subtitle: { fontSize: 14, color: '#666', marginTop: 4 },
  
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 20, marginBottom: 15, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: {width: 0, height: 2} },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#444', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', paddingBottom: 10 },
  
  label: { fontSize: 14, fontWeight: 'bold', color: '#555', marginBottom: 5 },
  input: { backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#eee', padding: 12, borderRadius: 8, fontSize: 15, marginBottom: 15, color: '#333' },
  
  btnAction: { backgroundColor: '#3498db', paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  btnActionText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  noData: { color: '#888', fontStyle: 'italic', textAlign: 'center', marginTop: 10 },

  promoItem: { backgroundColor: '#fafafa', borderWidth: 1, borderColor: '#eee', borderRadius: 10, padding: 15, marginBottom: 15 },
  promoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  promoTitle: { fontSize: 16, fontWeight: 'bold', color: '#2c3e50' },
  deleteText: { fontSize: 18 },
  
  messageBox: { backgroundColor: '#e8f5e9', padding: 12, borderRadius: 8, marginBottom: 15 },
  messageText: { fontSize: 14, color: '#2e7d32', fontStyle: 'italic' },

  btnWhatsapp: { backgroundColor: '#25D366', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  btnWhatsappText: { color: '#fff', fontWeight: 'bold', fontSize: 15 }
});
