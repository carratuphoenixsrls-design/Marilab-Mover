import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, radius, spacing, typography } from '@/constants/app-theme';
import { roleLabels } from '@/lib/format';
import { useAppStore } from '@/store/app-store';
import type { AppUser, UserRole } from '@/types/domain';
import { AppButton, AppInput, Card, EmptyState } from './ui';

interface TemporaryCredentials {
  title: string;
  fullName: string;
  email: string;
  password: string;
}

export function UserManagementModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { width } = useWindowDimensions();
  const isDesktopLayout = Platform.OS === 'web' && width >= 900;
  const {
    users,
    sites,
    currentUser,
    createUser,
    updateUser,
    deleteOrArchiveUser,
    toggleUserActive,
    resetUserPassword,
  } = useAppStore();
  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser>();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('requester');
  const [siteId, setSiteId] = useState<string>();
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string>();
  const [temporaryCredentials, setTemporaryCredentials] = useState<TemporaryCredentials | null>(null);
  const [copyFeedback, setCopyFeedback] = useState('');

  const resetForm = () => {
    setEditingUser(undefined);
    setFullName('');
    setEmail('');
    setPhone('');
    setRole('requester');
    setSiteId(undefined);
    setError('');
    setFormOpen(false);
  };

  const openCreate = () => {
    resetForm();
    setFormOpen(true);
  };

  const openEdit = (user: AppUser) => {
    setEditingUser(user);
    setFullName(user.fullName);
    setEmail(user.email);
    setPhone(user.phone ?? '');
    setRole(user.role);
    setSiteId(user.siteId);
    setError('');
    setFormOpen(true);
  };

  useEffect(() => {
    if (!visible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- chiude e ripulisce il form insieme al modal.
      setEditingUser(undefined);
      setFullName('');
      setEmail('');
      setPhone('');
      setRole('requester');
      setSiteId(undefined);
      setError('');
      setFormOpen(false);
      setTemporaryCredentials(null);
    }
  }, [visible]);

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    setError('');
    const input = {
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim() || undefined,
      role,
      siteId: role === 'mover' ? undefined : siteId,
    };
    if (editingUser) {
      const result = await updateUser({ id: editingUser.id, ...input });
      setSaving(false);
      if (!result.ok) {
        setError(result.error ?? 'Modifica non riuscita.');
        return;
      }
      resetForm();
      return;
    }

    const result = await createUser(input);
    setSaving(false);
    if (result.error || !result.user || !result.temporaryPassword) {
      setError(result.error ?? 'Creazione utente non riuscita.');
      return;
    }
    setCopyFeedback('');
    setTemporaryCredentials({
      title: 'Utente creato',
      fullName: result.user.fullName,
      email: result.user.email,
      password: result.temporaryPassword,
    });
    resetForm();
  };

  const copyCredentials = async () => {
    if (!temporaryCredentials) return;
    const value = `Marilab Mover\nNome: ${temporaryCredentials.fullName}\nEmail: ${temporaryCredentials.email}\nPassword temporanea: ${temporaryCredentials.password}`;
    try {
      if (Platform.OS === 'web' && globalThis.navigator?.clipboard) {
        await globalThis.navigator.clipboard.writeText(value);
        setCopyFeedback('Credenziali copiate.');
      } else {
        setCopyFeedback('Tieni premuto sui campi per copiare email e password.');
      }
    } catch {
      setCopyFeedback('Copia manualmente email e password mostrate qui sopra.');
    }
  };

  const resetPasswordFor = async (user: AppUser) => {
    setBusyUserId(user.id);
    const result = await resetUserPassword(user.id);
    setBusyUserId(undefined);
    if (!result.password) {
      const message = result.error ?? 'Impossibile generare la nuova password temporanea.';
      if (Platform.OS === 'web' && typeof window !== 'undefined') window.alert(message);
      else Alert.alert('Operazione non riuscita', message);
      return;
    }
    setCopyFeedback('');
    setTemporaryCredentials({
      title: 'Nuova password temporanea',
      fullName: user.fullName,
      email: user.email,
      password: result.password,
    });
  };

  const confirmResetPassword = (user: AppUser) => {
    if (user.id === currentUser.id) {
      const message = 'Per il tuo account usa “Cambia password” nella schermata Profilo.';
      if (Platform.OS === 'web' && typeof window !== 'undefined') window.alert(message);
      else Alert.alert('Account personale', message);
      return;
    }
    const message = `La password attuale di ${user.fullName} non può essere visualizzata. Verrà sostituita con una nuova password temporanea da consegnare al collega.`;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(`${message}

Continuare?`)) void resetPasswordFor(user);
      return;
    }
    Alert.alert('Generare una nuova password?', message, [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Genera password', onPress: () => void resetPasswordFor(user) },
    ]);
  };

  const deleteUser = async (user: AppUser) => {
    setBusyUserId(user.id);
    try {
      const result = await deleteOrArchiveUser(user.id);
      if (!result.ok) {
        const message = result.error ?? 'Operazione non riuscita.';
        if (Platform.OS === 'web' && typeof window !== 'undefined') window.alert(`Operazione non riuscita\n\n${message}`);
        else Alert.alert('Operazione non riuscita', message);
        return;
      }

      const title = result.mode === 'deleted' ? 'Utente eliminato' : 'Utente archiviato';
      const message = result.mode === 'deleted'
        ? 'L’account è stato rimosso definitivamente.'
        : 'L’account è stato disattivato e lo storico è rimasto integro.';
      if (Platform.OS === 'web' && typeof window !== 'undefined') window.alert(`${title}\n\n${message}`);
      else Alert.alert(title, message);
    } finally {
      setBusyUserId(undefined);
    }
  };

  const confirmDelete = (user: AppUser) => {
    if (user.id === currentUser.id) {
      const message = 'Non puoi eliminare il tuo account Admin.';
      if (Platform.OS === 'web' && typeof window !== 'undefined') window.alert(message);
      else Alert.alert('Operazione non disponibile', message);
      return;
    }

    const message = `${user.fullName} verrà eliminato definitivamente se non ha storico. Se ha già attività o messaggi, verrà disattivato e archiviato per preservare i dati.`;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(`Eliminare o archiviare utente?\n\n${message}\n\nContinuare?`)) void deleteUser(user);
      return;
    }

    Alert.alert('Eliminare o archiviare utente?', message, [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Continua', style: 'destructive', onPress: () => void deleteUser(user) },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.headerButton}><Ionicons name="close" size={25} color={palette.text} /></Pressable>
          <View style={styles.headerText}><Text style={styles.title}>Utenti e ruoli</Text><Text style={styles.subtitle}>Gestione riservata agli Admin</Text></View>
          <Pressable onPress={openCreate} style={styles.addButton}><Ionicons name="person-add-outline" size={22} color={palette.white} /></Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.ruleBanner}>
            <Ionicons name="shield-checkmark-outline" size={23} color={palette.brand} />
            <Text style={styles.ruleText}>Le password correnti non sono visibili, nemmeno agli Admin. Per assistere un collega usa “Nuova password”: il sistema sostituisce quella precedente e mostra una credenziale temporanea da copiare una sola volta.</Text>
          </View>

          {formOpen ? (
            <Card style={styles.formCard}>
              <View style={styles.formHeading}>
                <Text style={styles.formTitle}>{editingUser ? 'Modifica utente' : 'Nuovo utente'}</Text>
                <Text style={styles.formSubtitle}>{editingUser ? 'Aggiorna dati, ruolo e sede.' : 'Verrà generata una password temporanea per il primo accesso.'}</Text>
              </View>
              <AppInput label="Nome e cognome" value={fullName} onChangeText={setFullName} placeholder="Nome Cognome" />
              <AppInput label="Email aziendale" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="nome@marilab.it" />
              <AppInput label="Telefono (facoltativo)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="Numero interno o cellulare" />
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Ruolo</Text>
                <View style={styles.roleRow}>
                  {(['requester', 'mover', 'admin'] as UserRole[]).map((item) => (
                    <Pressable key={item} onPress={() => setRole(item)} style={[styles.roleChip, role === item && styles.roleChipActive]}>
                      <Text style={[styles.roleChipText, role === item && styles.roleChipTextActive]}>{roleLabels[item]}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              {role !== 'mover' ? (
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Sede</Text>
                  <View style={styles.siteGrid}>
                    {sites.filter((site) => site.active).map((site) => (
                      <Pressable key={site.id} onPress={() => setSiteId(site.id)} style={[styles.siteChip, siteId === site.id && styles.siteChipActive]}>
                        <Ionicons name="location-outline" size={16} color={siteId === site.id ? palette.brand : palette.textMuted} />
                        <Text style={[styles.siteChipText, siteId === site.id && styles.siteChipTextActive]}>{site.shortName}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <View style={styles.formActions}>
                <View style={styles.actionFlex}><AppButton label="Annulla" variant="secondary" onPress={resetForm} /></View>
                <View style={styles.actionFlex}><AppButton label={saving ? 'Salvataggio…' : editingUser ? 'Salva modifiche' : 'Crea utente'} disabled={saving} onPress={() => void submit()} /></View>
              </View>
            </Card>
          ) : null}

          {users.length ? (
            <View style={[styles.userGrid, isDesktopLayout && styles.userGridDesktop]}>
              {users.map((user) => {
                const site = sites.find((item) => item.id === user.siteId);
                const busy = busyUserId === user.id;
                return (
                  <View key={user.id} style={isDesktopLayout ? styles.userGridItemDesktop : styles.userGridItem}>
                    <Card style={[styles.userCard, isDesktopLayout && styles.userCardDesktop, !user.active && styles.userCardInactive]}>
                <View style={[styles.avatar, !user.active && styles.avatarInactive]}><Text style={styles.avatarText}>{initials(user.fullName)}</Text></View>
                <View style={styles.userInfo}>
                  <View style={styles.nameLine}>
                    <Text style={styles.userName}>{user.fullName}</Text>
                    {user.id === currentUser.id ? <Text style={styles.meBadge}>TU</Text> : null}
                  </View>
                  <Text style={styles.userEmail}>{user.email}</Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.roleBadge}>{roleLabels[user.role]}</Text>
                    {site ? <Text style={styles.siteText}>· {site.shortName}</Text> : null}
                    <Text style={[styles.stateText, user.active ? styles.stateActive : styles.stateInactive]}>· {user.active ? 'Attivo' : 'Disattivato'}</Text>
                    {user.mustChangePassword ? <Text style={styles.passwordBadge}>Primo accesso</Text> : null}
                  </View>
                </View>
                <View style={[styles.userActions, isDesktopLayout && styles.userActionsDesktop]}>
                  <UserActionButton
                    compact={!isDesktopLayout}
                    icon="create-outline"
                    label="Modifica"
                    accessibilityLabel="Modifica utente"
                    disabled={busy}
                    onPress={() => openEdit(user)}
                  />
                  <UserActionButton
                    compact={!isDesktopLayout}
                    icon="key-outline"
                    label={user.id === currentUser.id ? 'Cambia dal profilo' : 'Nuova password'}
                    accessibilityLabel="Genera nuova password temporanea"
                    disabled={busy}
                    onPress={() => confirmResetPassword(user)}
                  />
                  {user.id !== currentUser.id ? (
                    <>
                      <UserActionButton
                        compact={!isDesktopLayout}
                        icon={user.active ? 'pause-outline' : 'play-outline'}
                        label={user.active ? 'Disattiva' : 'Riattiva'}
                        accessibilityLabel={user.active ? 'Disattiva utente' : 'Riattiva utente'}
                        disabled={busy}
                        tone={user.active ? 'danger' : 'success'}
                        onPress={async () => {
                          setBusyUserId(user.id);
                          const result = await toggleUserActive(user.id);
                          setBusyUserId(undefined);
                          if (!result.ok) {
                            if (Platform.OS === 'web' && typeof window !== 'undefined') window.alert(result.error ?? 'Operazione non disponibile.');
                            else Alert.alert('Operazione non disponibile', result.error);
                          }
                        }}
                      />
                      <UserActionButton
                        compact={!isDesktopLayout}
                        icon="trash-outline"
                        label="Elimina"
                        accessibilityLabel="Elimina utente"
                        disabled={busy}
                        tone="danger"
                        onPress={() => confirmDelete(user)}
                      />
                    </>
                  ) : null}
                </View>
                    </Card>
                  </View>
                );
              })}
            </View>
          ) : <EmptyState icon="people-outline" title="Nessun utente" text="Aggiungi il primo account autorizzato." />}
        </ScrollView>

        {temporaryCredentials ? (
          <View style={styles.credentialsOverlay}>
            <Pressable accessibilityLabel="Chiudi finestra credenziali" style={styles.credentialsBackdrop} onPress={() => setTemporaryCredentials(null)} />
            <View style={styles.credentialsCard}>
              <View style={styles.credentialsIcon}><Ionicons name="key-outline" size={28} color={palette.brand} /></View>
              <Text style={styles.credentialsTitle}>{temporaryCredentials.title}</Text>
              <Text style={styles.credentialsIntro}>La password precedente non è stata letta: è stata sostituita. Copia ora la credenziale temporanea e consegnala al collega; al primo accesso dovrà crearne una personale.</Text>
              <View style={styles.credentialsField}><Text style={styles.credentialsLabel}>Nome</Text><Text selectable style={styles.credentialsValue}>{temporaryCredentials.fullName}</Text></View>
              <View style={styles.credentialsField}><Text style={styles.credentialsLabel}>Email</Text><Text selectable style={styles.credentialsValue}>{temporaryCredentials.email}</Text></View>
              <View style={[styles.credentialsField, styles.passwordField]}><Text style={styles.credentialsLabel}>Password temporanea</Text><Text selectable style={styles.passwordValue}>{temporaryCredentials.password}</Text></View>
              {copyFeedback ? <Text style={styles.copyFeedback}>{copyFeedback}</Text> : null}
              <View style={styles.credentialsActions}>
                <View style={styles.actionFlex}><AppButton label="Copia credenziali" icon="copy-outline" variant="secondary" onPress={() => void copyCredentials()} /></View>
                <View style={styles.actionFlex}><AppButton label="Chiudi" onPress={() => setTemporaryCredentials(null)} /></View>
              </View>
            </View>
          </View>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

function UserActionButton({
  compact,
  icon,
  label,
  accessibilityLabel,
  disabled,
  tone = 'default',
  onPress,
}: {
  compact: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  accessibilityLabel: string;
  disabled?: boolean;
  tone?: 'default' | 'danger' | 'success';
  onPress: () => void | Promise<void>;
}) {
  const iconColor = tone === 'danger' ? palette.danger : tone === 'success' ? palette.success : palette.brand;
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={() => void onPress()}
      style={({ pressed }) => [
        compact ? styles.iconButton : styles.labeledActionButton,
        tone === 'danger' && styles.iconDanger,
        tone === 'success' && styles.iconSuccess,
        pressed && styles.actionPressed,
        disabled && styles.actionDisabled,
      ]}>
      <Ionicons name={icon} size={compact ? 20 : 17} color={iconColor} />
      {!compact ? <Text style={[styles.labeledActionText, { color: iconColor }]}>{label}</Text> : null}
    </Pressable>
  );
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');
}

const styles = StyleSheet.create({
  safe: { flex: 1, minHeight: 0, width: '100%', backgroundColor: palette.background },
  header: { minHeight: 72, backgroundColor: palette.surface, borderBottomWidth: 1, borderBottomColor: palette.border, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerButton: { width: 42, height: 42, borderRadius: 14, backgroundColor: palette.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, alignItems: 'center' },
  title: { color: palette.text, fontFamily: typography.display, fontWeight: '800', fontSize: 19 },
  subtitle: { color: palette.textMuted, fontFamily: typography.body, fontSize: 11, marginTop: 2 },
  addButton: { width: 42, height: 42, borderRadius: 14, backgroundColor: palette.brand, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.lg, paddingBottom: spacing.huge, gap: spacing.md, maxWidth: Platform.OS === 'web' ? 1560 : 900, width: '100%', alignSelf: 'center' },
  ruleBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: palette.brandMist, borderWidth: 1, borderColor: '#D7EAFD' },
  ruleText: { flex: 1, color: palette.textMuted, fontFamily: typography.body, fontSize: 13, lineHeight: 19 },
  formCard: { gap: spacing.lg, borderColor: '#B9DAFA' },
  formHeading: { gap: 3 },
  formTitle: { color: palette.text, fontFamily: typography.display, fontSize: 21, fontWeight: '800' },
  formSubtitle: { color: palette.textMuted, fontFamily: typography.body, fontSize: 12 },
  fieldGroup: { gap: spacing.sm },
  fieldLabel: { color: palette.text, fontFamily: typography.body, fontWeight: '800', fontSize: 14 },
  roleRow: { flexDirection: 'row', gap: spacing.sm },
  roleChip: { flex: 1, minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center' },
  roleChipActive: { backgroundColor: palette.brandSoft, borderColor: palette.brand },
  roleChipText: { color: palette.textMuted, fontFamily: typography.body, fontSize: 12, fontWeight: '800' },
  roleChipTextActive: { color: palette.brand },
  siteGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  siteChip: { minHeight: 42, borderRadius: radius.pill, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 6 },
  siteChipActive: { backgroundColor: palette.brandSoft, borderColor: palette.brand },
  siteChipText: { color: palette.textMuted, fontFamily: typography.body, fontSize: 12, fontWeight: '700' },
  siteChipTextActive: { color: palette.brand },
  error: { color: palette.danger, fontFamily: typography.body, fontWeight: '700', fontSize: 13 },
  formActions: { flexDirection: 'row', gap: spacing.md },
  actionFlex: { flex: 1 },
  userGrid: { width: '100%', gap: spacing.md },
  userGridDesktop: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch' },
  userGridItem: { width: '100%' },
  userGridItemDesktop: { width: '49%', minWidth: 620, flexGrow: 1 },
  userCard: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  userCardDesktop: { paddingVertical: spacing.lg, paddingHorizontal: spacing.lg },
  userCardInactive: { opacity: 0.64, backgroundColor: palette.surfaceMuted },
  avatar: { width: 48, height: 48, borderRadius: 16, backgroundColor: palette.brand, alignItems: 'center', justifyContent: 'center' },
  avatarInactive: { backgroundColor: palette.textMuted },
  avatarText: { color: palette.white, fontFamily: typography.display, fontWeight: '900', fontSize: 15 },
  userInfo: { flex: 1, gap: 3, minWidth: 120 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  userName: { color: palette.text, fontFamily: typography.display, fontWeight: '800', fontSize: 15, flexShrink: 1 },
  meBadge: { color: palette.brand, backgroundColor: palette.brandSoft, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 3, fontFamily: typography.body, fontSize: 9, fontWeight: '900' },
  userEmail: { color: palette.textMuted, fontFamily: typography.body, fontSize: 11 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 3 },
  roleBadge: { color: palette.brand, fontFamily: typography.body, fontSize: 10, fontWeight: '900' },
  siteText: { color: palette.textMuted, fontFamily: typography.body, fontSize: 10 },
  stateText: { fontFamily: typography.body, fontSize: 10, fontWeight: '900' },
  stateActive: { color: palette.success },
  stateInactive: { color: palette.danger },
  passwordBadge: { color: palette.warning, backgroundColor: palette.warningSoft, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 3, fontFamily: typography.body, fontSize: 9, fontWeight: '900' },
  userActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 6, maxWidth: 94 },
  userActionsDesktop: { maxWidth: 420, flexWrap: 'nowrap', alignItems: 'center' },
  iconButton: { width: 40, height: 40, borderRadius: 13, backgroundColor: palette.brandMist, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D7EAFD' },
  labeledActionButton: { minHeight: 40, borderRadius: 13, backgroundColor: palette.brandMist, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: '#D7EAFD' },
  labeledActionText: { fontFamily: typography.body, fontSize: 11, fontWeight: '900' },
  actionPressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
  actionDisabled: { opacity: 0.45 },
  iconDanger: { backgroundColor: palette.dangerSoft, borderColor: '#F4C7C7' },
  iconSuccess: { backgroundColor: palette.successSoft, borderColor: '#BFE8D2' },
  credentialsOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 50, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  credentialsBackdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(7, 24, 45, 0.48)' },
  credentialsCard: { width: '100%', maxWidth: 520, backgroundColor: palette.surface, borderRadius: 26, padding: spacing.xl, gap: spacing.md, borderWidth: 1, borderColor: '#D7EAFD', shadowColor: palette.shadow, shadowOpacity: 0.22, shadowRadius: 34, shadowOffset: { width: 0, height: 18 }, elevation: 12 },
  credentialsIcon: { width: 58, height: 58, borderRadius: 19, backgroundColor: palette.brandMist, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  credentialsTitle: { color: palette.text, fontFamily: typography.display, fontWeight: '900', fontSize: 22, textAlign: 'center' },
  credentialsIntro: { color: palette.textMuted, fontFamily: typography.body, fontSize: 13, lineHeight: 19, textAlign: 'center', marginBottom: spacing.xs },
  credentialsField: { backgroundColor: palette.surfaceMuted, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: 4, borderWidth: 1, borderColor: palette.border },
  passwordField: { backgroundColor: palette.brandMist, borderColor: '#B9DAFA' },
  credentialsLabel: { color: palette.textMuted, fontFamily: typography.body, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  credentialsValue: { color: palette.text, fontFamily: typography.body, fontSize: 15, fontWeight: '800' },
  passwordValue: { color: palette.brandDark, fontFamily: typography.display, fontSize: 23, fontWeight: '900', letterSpacing: 0.8 },
  copyFeedback: { color: palette.success, fontFamily: typography.body, fontWeight: '800', fontSize: 12, textAlign: 'center' },
  credentialsActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs },
});
