import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Image, Linking, ScrollView } from 'react-native';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, uploadString } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { db, storage } from '../config/firebase';

interface Expense {
  id: string;
  concept: string;
  date: string;
  amount: number;
  ticketUrl?: string;
  team?: string;
  createdAt: any;
}

export default function ExpensesScreen() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [concept, setConcept] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedTeam, setSelectedTeam] = useState('Oficina/General');
  const [ticketImage, setTicketImage] = useState<string | null>(null);
  const [ticketBase64, setTicketBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'expenses'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const expensesList: Expense[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        expensesList.push({ id: docSnap.id, ...data, amount: Number(data.amount || 0) } as Expense);
      });
      setExpenses(expensesList);
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

  const handleImageResult = (result: ImagePicker.ImagePickerResult) => {
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setTicketImage(result.assets[0].uri);
      if (result.assets[0].base64) {
        setTicketBase64(result.assets[0].base64);
      }
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.2,
        base64: true,
      });
      handleImageResult(result);
    } catch (error) {
      alert('Error al seleccionar la imagen.');
    }
  };

  const takePhoto = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.2,
        base64: true,
      });
      handleImageResult(result);
    } catch (error) {
      alert('Error al abrir la cámara.');
    }
  };

  const saveExpense = async () => {
    if (concept.trim() === '' || amount.trim() === '' || date.trim() === '') {
      alert('Por favor, completa concepto, importe y fecha.');
      return;
    }

    try {
      setUploading(true);
      let downloadUrl = '';

      if (ticketImage) {
        const fileName = `tickets/${Date.now()}.jpg`;
        const storageRef = ref(storage, fileName);

        if (ticketBase64) {
          const dataUrl = `data:image/jpeg;base64,${ticketBase64}`;
          await uploadString(storageRef, dataUrl, 'data_url');
        } else if (ticketImage.startsWith('data:')) {
          await uploadString(storageRef, ticketImage, 'data_url');
        } else {
          const response = await fetch(ticketImage);
          const blob = await response.blob();
          await uploadBytes(storageRef, blob);
        }
        
        downloadUrl = await getDownloadURL(storageRef);
      }

      await addDoc(collection(db, 'expenses'), {
        concept: concept.trim(),
        amount: parseFloat(amount.replace(',', '.')),
        date: date.trim(),
        ticketUrl: downloadUrl || null,
        team: selectedTeam,
        createdAt: new Date()
      });

      setConcept('');
      setAmount('');
      setDate(new Date().toISOString().split('T')[0]);
      setSelectedTeam('Oficina/General');
      setTicketImage(null);
      setTicketBase64(null);
      setUploading(false);
    } catch (error) {
      console.log('Error uploading ticket:', error);
      alert('Hubo un error al guardar el gasto.');
      setUploading(false);
    }
  };

  const deleteExpense = async (id: string, conceptName: string) => {
    if (window.confirm(`¿Seguro que deseas eliminar el gasto "${conceptName}"?`)) {
      try {
        await deleteDoc(doc(db, 'expenses', id));
      } catch (error) {
        alert('Hubo un error al eliminar el gasto.');
      }
    }
  };

  // PDF EXPORT LOGIC
  const [filterStart, setFilterStart] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [filterEnd, setFilterEnd] = useState(new Date().toISOString().split('T')[0]);

  const generatePDF = async () => {
    const filteredExpenses = expenses.filter(e => e.date >= filterStart && e.date <= filterEnd);
    if (filteredExpenses.length === 0) {
      alert('No hay gastos en este rango de fechas para exportar.');
      return;
    }

    const total = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

    const rows = filteredExpenses.map(e => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #ddd;">${e.date}</td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>${e.concept}</strong><br/><small style="color: #666;">${e.team === 'Oficina/General' ? 'Oficina' : e.team}</small></td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd; font-weight: bold; color: #d9534f;">${e.amount.toFixed(2)} €</td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: center;">${e.ticketUrl ? '✅' : '❌'}</td>
      </tr>
    `).join('');

    const ticketsHtml = filteredExpenses.filter(e => e.ticketUrl).map(e => `
      <div style="page-break-before: always; font-family: sans-serif; padding: 20px;">
        <h2 style="color: #7A4B56;">Ticket Adjunto</h2>
        <p><strong>Fecha:</strong> ${e.date}</p>
        <p><strong>Concepto:</strong> ${e.concept}</p>
        <p><strong>Importe:</strong> ${e.amount.toFixed(2)} €</p>
        <img src="${e.ticketUrl}" style="max-width: 100%; max-height: 800px; border: 1px solid #ccc; margin-top: 15px;" />
      </div>
    `).join('');

    const html = `
      <html>
        <head>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; margin: 0; padding: 0; }
            .container { padding: 40px; }
            .header { border-bottom: 2px solid #d9534f; padding-bottom: 15px; margin-bottom: 30px; }
            h1 { color: #d9534f; margin: 0; font-size: 28px; }
            .subtitle { color: #666; font-size: 16px; margin-top: 5px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th { text-align: left; background-color: #f9f9f9; padding: 12px; color: #555; border-bottom: 2px solid #ddd; }
            .total-box { background-color: #fdf3f4; border: 1px solid #f5c6cb; padding: 20px; border-radius: 8px; text-align: right; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Informe de Gastos (Gestoría)</h1>
              <div class="subtitle">Periodo: ${filterStart} a ${filterEnd}</div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Concepto y Equipo</th>
                  <th>Importe</th>
                  <th style="text-align: center;">Ticket</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
            </table>
            <div class="total-box">
              <h2 style="margin: 0; color: #721c24;">Total Periodo: ${total.toFixed(2)} €</h2>
            </div>
          </div>
          ${ticketsHtml}
        </body>
      </html>
    `;

    try {
      if (Platform.OS === 'web') {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          setTimeout(() => printWindow.print(), 500);
        } else {
          alert('Permite las ventanas emergentes (pop-ups) para generar el PDF.');
        }
      } else {
        const { uri } = await Print.printToFileAsync({ html });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
        }
      }
    } catch (err) {
      alert('Error al generar el PDF.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>💸 Registrar Nuevo Gasto</Text>
      
      <View style={styles.formRow}>
        <TextInput
          style={[styles.input, { flex: 2 }]}
          placeholder="Concepto (ej. Gasolina Furgoneta 1)"
          value={concept}
          onChangeText={setConcept}
        />
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder="Importe (€)"
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
        />
      </View>
      
      <View style={styles.formRow}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder="Fecha (YYYY-MM-DD)"
          value={date}
          onChangeText={setDate}
        />
        <View style={{ flex: 1.5, flexDirection: 'row', gap: 6 }}>
          <TouchableOpacity style={styles.photoBtnSmall} onPress={takePhoto}>
            <Text style={styles.photoBtnText}>📷 Cámara</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.photoBtnSmall} onPress={pickImage}>
            <Text style={styles.photoBtnText}>📁 Galería</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.label}>Asignar Gasto a:</Text>
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
      
      {ticketImage && (
        <View style={{ alignItems: 'center', marginBottom: 15 }}>
          <Text style={{ color: '#D48A9A', fontWeight: 'bold', marginBottom: 4 }}>✓ Ticket adjuntado correctamente</Text>
          <Image source={{ uri: ticketImage }} style={styles.previewImg} />
        </View>
      )}

      <TouchableOpacity
        style={styles.buttonAdd}
        onPress={saveExpense}
        disabled={uploading}
      >
        {uploading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Añadir Gasto</Text>
        )}
      </TouchableOpacity>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 25, marginBottom: 10 }}>
        <Text style={[styles.titleList, { marginTop: 0, marginBottom: 0 }]}>Historial de Gastos</Text>
      </View>

      {/* Export Section */}
      <View style={styles.exportCard}>
        <Text style={styles.exportTitle}>📤 Exportar Informe a Gestoría (PDF)</Text>
        <View style={styles.formRow}>
          <TextInput
            style={[styles.input, { flex: 1, backgroundColor: '#FDF9fa' }]}
            placeholder="Desde YYYY-MM-DD"
            value={filterStart}
            onChangeText={setFilterStart}
          />
          <TextInput
            style={[styles.input, { flex: 1, backgroundColor: '#FDF9fa' }]}
            placeholder="Hasta YYYY-MM-DD"
            value={filterEnd}
            onChangeText={setFilterEnd}
          />
        </View>
        <TouchableOpacity style={styles.buttonExport} onPress={generatePDF}>
          <Text style={styles.buttonText}>📄 Generar PDF (Listado + Tickets)</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#d9534f" />
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={expenses}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.expenseCard}>
              <View style={styles.expenseInfo}>
                <Text style={styles.expenseDate}>{item.date}</Text>
                <Text style={styles.expenseConcept}>{item.concept || (item as any).description || 'Gasto sin nombre'}</Text>
                {item.team && item.team !== 'Oficina/General' ? (
                  <Text style={styles.expenseTeam}>🚐 {item.team}</Text>
                ) : (
                  <Text style={styles.expenseTeam}>🏢 Oficina/General</Text>
                )}
              </View>
              
              <View style={styles.expenseRight}>
                <Text style={styles.expenseAmount}>- {item.amount.toFixed(2)} €</Text>
                <View style={styles.cardActions}>
                  {item.ticketUrl ? (
                    <TouchableOpacity style={styles.ticketBtn} onPress={() => Linking.openURL(item.ticketUrl!)}>
                      <Text style={styles.ticketIcon}>🧾 Ver Ticket</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity style={styles.iconBtn} onPress={() => deleteExpense(item.id, item.concept || (item as any).description || 'Gasto')}>
                    <Text style={styles.actionIcon}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No hay gastos registrados aún.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f9f9f9' },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, color: '#d9534f' },
  titleList: { fontSize: 18, fontWeight: 'bold', marginTop: 25, marginBottom: 15, color: '#d9534f' },
  formRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 8, fontSize: 15 },
  label: { fontSize: 13, fontWeight: 'bold', color: '#555', marginBottom: 6, marginTop: 4 },
  teamScrollRow: { marginBottom: 15, maxHeight: 40 },
  teamChip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fff', marginRight: 8, height: 35, justifyContent: 'center' },
  teamChipActive: { backgroundColor: '#d9534f', borderColor: '#d9534f' },
  teamChipTextActive: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  teamChipTextInactive: { color: '#555', fontSize: 13 },
  photoBtnSmall: { flex: 1, backgroundColor: '#FDF9fa', borderWidth: 1, borderColor: '#EADDE0', paddingVertical: 12, paddingHorizontal: 5, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  photoBtnText: { color: '#7A4B56', fontWeight: 'bold', fontSize: 13 },
  previewImg: { width: 100, height: 100, borderRadius: 8, alignSelf: 'center', marginBottom: 5 },
  buttonAdd: { backgroundColor: '#d9534f', padding: 14, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  
  exportCard: { backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: '#f5c6cb' },
  exportTitle: { fontSize: 14, fontWeight: 'bold', color: '#721c24', marginBottom: 10 },
  buttonExport: { backgroundColor: '#721c24', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 5 },
  
  expenseCard: { backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderLeftWidth: 4, borderLeftColor: '#d9534f', elevation: 1 },
  expenseInfo: { flex: 1 },
  expenseDate: { fontSize: 12, color: '#777', fontWeight: 'bold', marginBottom: 2 },
  expenseConcept: { fontSize: 15, fontWeight: 'bold', color: '#333' },
  expenseTeam: { fontSize: 12, color: '#555', marginTop: 4, fontStyle: 'italic' },
  expenseRight: { alignItems: 'flex-end' },
  expenseAmount: { fontSize: 16, fontWeight: 'bold', color: '#d9534f', marginBottom: 6 },
  cardActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  ticketBtn: { backgroundColor: '#F9F1F3', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 1, borderColor: '#cce0f5' },
  ticketIcon: { fontSize: 12, color: '#7A4B56', fontWeight: 'bold' },
  iconBtn: { padding: 4 },
  actionIcon: { fontSize: 16 },
  empty: { color: '#888', fontStyle: 'italic', textAlign: 'center', marginTop: 20 }
});
