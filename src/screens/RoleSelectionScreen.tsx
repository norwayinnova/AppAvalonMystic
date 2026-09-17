import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Image, ScrollView } from 'react-native';
import { collection, doc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAppContext } from '../context/AppContext';

export default function RoleSelectionScreen() {
  const { loginAsAdmin, loginAsManagement, loginAsTeam, loginAsClient } = useAppContext();
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showPinInput, setShowPinInput] = useState(false);
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [adminConfig, setAdminConfig] = useState({ pinEnabled: true, pin: '1234' });
  const [loginTarget, setLoginTarget] = useState<any>(null); // { type: 'admin' } | { type: 'team', team: obj } | { type: 'management' }

  useEffect(() => {
    const q = query(collection(db, 'teams'), orderBy('name'));
    const unsubTeams = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach(docSnap => list.push({ id: docSnap.id, ...docSnap.data() }));
      setTeams(list);
      setLoading(false);
    });
    const unsubConfig = onSnapshot(doc(db, 'config', 'admin'), (docSnap) => {
      if (docSnap.exists()) setAdminConfig(docSnap.data() as any);
    });
    return () => { unsubTeams(); unsubConfig(); };
  }, []);

  const initiateLogin = (target: any) => {
    setLoginTarget(target);
    setShowPinInput(true);
    setPin('');
    setErrorMsg('');
  };

  const handleSubmitPin = () => {
    if (!loginTarget) return;

    if (loginTarget.type === 'admin') {
      if (!adminConfig.pinEnabled || pin === adminConfig.pin) {
        loginAsAdmin();
      } else {
        setErrorMsg('PIN incorrecto. Inténtalo de nuevo.');
        setPin('');
      }
    } else if (loginTarget.type === 'management') {
      // Management uses admin PIN or maybe no PIN? The plan said lock all internal profiles.
      // Let's just use admin pin for management for now, or '1234'.
      if (pin === (adminConfig.pin || '1234')) {
        loginAsManagement();
      } else {
        setErrorMsg('PIN incorrecto.');
        setPin('');
      }
    } else if (loginTarget.type === 'team') {
      const teamPin = loginTarget.team.pin || '1234';
      if (pin === teamPin) {
        loginAsTeam(loginTarget.team.name);
      } else {
        setErrorMsg('PIN incorrecto.');
        setPin('');
      }
    }
  };

  const renderPinDots = () => (
    <View style={styles.pinDots}>
      {[0, 1, 2, 3].map(i => (
        <View key={i} style={[styles.pinDot, i < pin.length && styles.pinDotFilled]} />
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.bgCircle1} />
      <View style={styles.bgCircle2} />
      <View style={styles.bgCircle3} />

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.logoWrapper}>
          <Image source={require('../../assets/logo.jpg')} style={styles.logo} resizeMode="contain" />
        </View>

        <View style={styles.card}>
          {showPinInput ? (
            <View style={styles.pinSection}>
              <Text style={styles.pinTitle}>🔐 {loginTarget?.type === 'admin' ? 'Zona Administrador' : loginTarget?.type === 'team' ? `Perfil de ${loginTarget?.team?.name}` : 'Acceso de Gestión'}</Text>
              <Text style={styles.pinSubtitle}>Introduce tu PIN de acceso</Text>
              {renderPinDots()}
              <TextInput
                style={styles.hiddenInput}
                keyboardType="numeric"
                secureTextEntry
                maxLength={4}
                value={pin}
                onChangeText={(text) => { setPin(text); setErrorMsg(''); }}
                autoFocus
              />
              {errorMsg ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>❌ {errorMsg}</Text>
                </View>
              ) : null}
              <TouchableOpacity style={styles.primaryBtn} onPress={handleSubmitPin}>
                <Text style={styles.primaryBtnText}>Entrar →</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.ghostBtn} onPress={() => { setShowPinInput(false); setPin(''); setErrorMsg(''); }}>
                <Text style={styles.ghostBtnText}>← Volver</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <Text style={styles.cardTitle}>¿Quién eres?</Text>

              {/* Cliente */}
              <TouchableOpacity style={styles.clientBtn} onPress={loginAsClient}>
                <View style={styles.btnInner}>
                  <Text style={styles.btnEmoji}>📅</Text>
                  <View>
                    <Text style={[styles.adminBtnTitle, {color: '#fff'}]}>Soy Cliente</Text>
                    <Text style={[styles.adminBtnSub, {color: '#eee'}]}>Reservar cita online</Text>
                  </View>
                </View>
                <Text style={[styles.chevron, {color: '#fff'}]}>›</Text>
              </TouchableOpacity>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>Acceso Personal</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Admin */}
              <TouchableOpacity style={styles.adminBtn} onPress={() => initiateLogin({ type: 'admin' })}>
                <View style={styles.btnInner}>
                  <Text style={styles.btnEmoji}>👑</Text>
                  <View>
                    <Text style={styles.adminBtnTitle}>Administrador</Text>
                    <Text style={styles.adminBtnSub}>Acceso completo al sistema</Text>
                  </View>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>

              {/* Gestión */}
              <TouchableOpacity style={styles.mgmtBtn} onPress={() => initiateLogin({ type: 'management' })}>
                <View style={styles.btnInner}>
                  <Text style={styles.btnEmoji}>📋</Text>
                  <View>
                    <Text style={styles.mgmtBtnTitle}>Gestión</Text>
                    <Text style={styles.mgmtBtnSub}>Clientes, calendario y operativa</Text>
                  </View>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>o accede como equipo</Text>
                <View style={styles.dividerLine} />
              </View>

              {loading ? (
                <ActivityIndicator color="#D48A9A" size="large" style={{ marginTop: 20 }} />
              ) : (
                teams.map((t, i) => (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.teamBtn, { borderLeftColor: TEAM_COLORS[i % TEAM_COLORS.length] }]}
                    onPress={() => initiateLogin({ type: 'team', team: t })}
                  >
                    <View style={styles.btnInner}>
                      <Text style={styles.btnEmoji}>🚐</Text>
                      <View>
                        <Text style={styles.teamBtnTitle}>{t.name}</Text>
                        <Text style={styles.teamBtnSub}>{t.members || 'Equipo de trabajo'}</Text>
                      </View>
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </TouchableOpacity>
                ))
              )}
              {!loading && teams.length === 0 && (
                <Text style={styles.emptyText}>No hay equipos creados aún.</Text>
              )}
            </View>
          )}
        </View>

        <Text style={styles.footer}>Avalon Mystic © 2026</Text>
      </ScrollView>
    </View>
  );
}

const TEAM_COLORS = ['#D48A9A', '#D48A9A', '#f39c12', '#9b59b6', '#e74c3c'];

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1b2a' },
  bgCircle1: { position: 'absolute', width: 350, height: 350, borderRadius: 175, backgroundColor: 'rgba(74,155,64,0.12)', top: -80, right: -80 },
  bgCircle2: { position: 'absolute', width: 250, height: 250, borderRadius: 125, backgroundColor: 'rgba(0,42,84,0.4)', bottom: 50, left: -60 },
  bgCircle3: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(52,152,219,0.08)', top: 200, left: 30 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24, minHeight: '100%' as any },
  logoWrapper: { alignItems: 'center', marginBottom: 28 },
  logo: { width: 180, height: 70 },
  card: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 20, padding: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  cardTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 20 },
  adminBtn: { backgroundColor: 'rgba(217,83,79,0.15)', borderWidth: 1.5, borderColor: '#d9534f', borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  adminBtnTitle: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  adminBtnSub: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 },
  clientBtn: { backgroundColor: '#7A4B56', borderWidth: 1.5, borderColor: '#D48A9A', borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  teamBtn: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderLeftWidth: 4, borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  teamBtnTitle: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  teamBtnSub: { color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 2 },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  btnEmoji: { fontSize: 28 },
  chevron: { color: 'rgba(255,255,255,0.3)', fontSize: 28, fontWeight: '200' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 20, gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  dividerText: { color: 'rgba(255,255,255,0.35)', fontSize: 12 },
  mgmtBtn: { backgroundColor: 'rgba(74,155,64,0.15)', borderWidth: 1.5, borderColor: '#D48A9A', borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, marginTop: 8 },
  mgmtBtnTitle: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  mgmtBtnSub: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 },
  pinSection: { gap: 4 },
  pinTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginBottom: 6 },
  pinSubtitle: { color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 20, fontSize: 14 },
  pinDots: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 20 },
  pinDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'transparent' },
  pinDotFilled: { backgroundColor: '#D48A9A', borderColor: '#D48A9A' },
  hiddenInput: { position: 'absolute', opacity: 0, height: 0 },
  errorBox: { backgroundColor: 'rgba(217,83,79,0.15)', borderRadius: 8, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(217,83,79,0.4)' },
  errorText: { color: '#ff6b6b', textAlign: 'center', fontWeight: 'bold', fontSize: 13 },
  primaryBtn: { backgroundColor: '#D48A9A', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  primaryBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  ghostBtn: { padding: 14, alignItems: 'center', marginTop: 6 },
  ghostBtnText: { color: 'rgba(255,255,255,0.45)', fontWeight: 'bold', fontSize: 14 },
  emptyText: { color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 20, fontStyle: 'italic' },
  footer: { color: 'rgba(255,255,255,0.2)', textAlign: 'center', marginTop: 30, fontSize: 12 },
});



