import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, radius, spacing, typography } from '@/constants/app-theme';
import { useAppStore } from '@/store/app-store';
import type { Equipment, Site } from '@/types/domain';
import { AppButton, AppInput, Card, EmptyState } from './ui';

function ModalHeader({ title, subtitle, onClose }: { title: string; subtitle: string; onClose: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable accessibilityLabel="Chiudi" onPress={onClose} style={styles.closeButton}>
        <Ionicons name="close" size={24} color={palette.text} />
      </Pressable>
      <View style={styles.headerText}>
        <Text style={styles.headerTitle}>{title}</Text>
        <Text style={styles.headerSubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.closePlaceholder} />
    </View>
  );
}

function ToggleChoice({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <Pressable onPress={() => onChange(!value)} style={[styles.toggleChoice, value && styles.toggleChoiceActive]}>
      <Ionicons name={value ? 'checkmark-circle' : 'ellipse-outline'} size={21} color={value ? palette.success : palette.textMuted} />
      <Text style={[styles.toggleChoiceText, value && styles.toggleChoiceTextActive]}>{label}</Text>
    </Pressable>
  );
}

function SiteChoice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.siteChoice, selected && styles.siteChoiceActive]}>
      <Ionicons name="location-outline" size={17} color={selected ? palette.white : palette.brand} />
      <Text style={[styles.siteChoiceText, selected && styles.siteChoiceTextActive]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

export function EquipmentEditorModal({
  visible,
  item,
  onClose,
}: {
  visible: boolean;
  item?: Equipment;
  onClose: () => void;
}) {
  const { sites, saveEquipment } = useAppStore();
  const activeSites = sites.filter((site) => site.active || site.id === item?.homeSiteId || site.id === item?.currentSiteId);
  const defaultSiteId = activeSites[0]?.id ?? '';
  const [inventoryCode, setInventoryCode] = useState('');
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [homeSiteId, setHomeSiteId] = useState('');
  const [currentSiteId, setCurrentSiteId] = useState('');
  const [accessories, setAccessories] = useState('');
  const [notes, setNotes] = useState('');
  const [movable, setMovable] = useState(true);
  const [active, setActive] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const fallbackSite = item?.homeSiteId ?? defaultSiteId;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronizza il form quando si apre il modal.
    setInventoryCode(item?.inventoryCode ?? '');
    setName(item?.name ?? '');
    setBrand(item?.brand ?? '');
    setModel(item?.model ?? '');
    setSerialNumber(item?.serialNumber ?? '');
    setHomeSiteId(fallbackSite);
    setCurrentSiteId(item?.currentSiteId ?? fallbackSite);
    setAccessories(item?.accessories.join(', ') ?? '');
    setNotes(item?.notes ?? '');
    setMovable(item?.movable ?? true);
    setActive(item?.active ?? true);
    setError('');
  }, [defaultSiteId, item, visible]);

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    setError('');
    const result = await saveEquipment({
      id: item?.id,
      inventoryCode,
      name,
      brand,
      model,
      serialNumber,
      homeSiteId,
      currentSiteId,
      movable,
      active,
      accessories: accessories.split(',').map((entry) => entry.trim()).filter(Boolean),
      notes,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? 'Salvataggio non riuscito.');
      return;
    }
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <ModalHeader title={item ? 'Modifica strumento' : 'Nuovo strumento'} subtitle="Inventario logistico Marilab Mover" onClose={onClose} />
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="handled">
            {!activeSites.length ? (
              <EmptyState icon="business-outline" title="Prima inserisci una sede" text="Ogni strumento deve avere una sede principale e una posizione attuale." />
            ) : (
              <>
                <View style={styles.twoColumns}>
                  <View style={styles.column}><AppInput label="Numero inventario *" value={inventoryCode} onChangeText={setInventoryCode} autoCapitalize="characters" placeholder="MOV-0007" /></View>
                  <View style={styles.column}><AppInput label="Nome apparecchiatura *" value={name} onChangeText={setName} placeholder="Es. Fibroscan" /></View>
                </View>
                <View style={styles.twoColumns}>
                  <View style={styles.column}><AppInput label="Marca" value={brand} onChangeText={setBrand} placeholder="Facoltativa" /></View>
                  <View style={styles.column}><AppInput label="Modello" value={model} onChangeText={setModel} placeholder="Facoltativo" /></View>
                </View>
                <AppInput label="Matricola" value={serialNumber} onChangeText={setSerialNumber} placeholder="Facoltativa" />

                <Text style={styles.fieldTitle}>Sede principale *</Text>
                <View style={styles.choiceWrap}>{activeSites.map((site) => <SiteChoice key={site.id} label={site.shortName} selected={homeSiteId === site.id} onPress={() => setHomeSiteId(site.id)} />)}</View>

                <Text style={styles.fieldTitle}>Posizione attuale *</Text>
                <View style={styles.choiceWrap}>{activeSites.map((site) => <SiteChoice key={site.id} label={site.shortName} selected={currentSiteId === site.id} onPress={() => setCurrentSiteId(site.id)} />)}</View>

                <AppInput label="Accessori" value={accessories} onChangeText={setAccessories} placeholder="Separali con una virgola" multiline />
                <AppInput label="Note" value={notes} onChangeText={setNotes} placeholder="Solo informazioni operative, nessun dato paziente" multiline />
                <View style={styles.toggleRow}>
                  <ToggleChoice label="Movimentabile" value={movable} onChange={setMovable} />
                  <ToggleChoice label="Attivo" value={active} onChange={setActive} />
                </View>
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <AppButton label={saving ? 'Salvataggio…' : item ? 'Salva modifiche' : 'Aggiungi strumento'} icon="checkmark-circle-outline" disabled={saving} onPress={() => void submit()} />
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

export function SiteManagementModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { sites, saveSite } = useAppStore();
  const [editing, setEditing] = useState<Site | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [address, setAddress] = useState('');
  const [mapsQuery, setMapsQuery] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [active, setActive] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const openForm = (site?: Site) => {
    setEditing(site ?? null);
    setName(site?.name ?? '');
    setShortName(site?.shortName ?? '');
    setAddress(site?.address ?? '');
    setMapsQuery(site?.mapsQuery ?? site?.address ?? '');
    setContactName(site?.contactName ?? '');
    setContactPhone(site?.contactPhone ?? '');
    setActive(site?.active ?? true);
    setError('');
    setFormOpen(true);
  };

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    setError('');
    const result = await saveSite({
      id: editing?.id,
      name,
      shortName,
      address,
      mapsQuery,
      contactName,
      contactPhone,
      active,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? 'Salvataggio non riuscito.');
      return;
    }
    setFormOpen(false);
    setEditing(null);
  };

  const openMaps = async (site: Site) => {
    const query = encodeURIComponent(site.mapsQuery || site.address);
    await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <ModalHeader title="Sedi e Google Maps" subtitle="Indirizzi, referenti e navigazione" onClose={onClose} />
        <ScrollView contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="handled">
          {!formOpen ? (
            <>
              <AppButton label="Aggiungi sede" icon="add-circle-outline" onPress={() => openForm()} />
              {sites.map((site) => (
                <Card key={site.id} style={styles.siteCard}>
                  <View style={styles.siteIcon}><Ionicons name="business-outline" size={23} color={palette.brand} /></View>
                  <View style={styles.siteText}>
                    <View style={styles.siteNameRow}>
                      <Text style={styles.siteName}>{site.shortName}</Text>
                      <Text style={[styles.stateBadge, !site.active && styles.stateBadgeOff]}>{site.active ? 'Attiva' : 'Disattivata'}</Text>
                    </View>
                    <Text style={styles.siteFullName}>{site.name}</Text>
                    <Text style={styles.siteAddress}>{site.address}</Text>
                    {site.contactName || site.contactPhone ? <Text style={styles.siteContact}>{[site.contactName, site.contactPhone].filter(Boolean).join(' · ')}</Text> : null}
                  </View>
                  <View style={styles.siteActions}>
                    <Pressable accessibilityLabel="Apri Google Maps" onPress={() => void openMaps(site)} style={styles.iconAction}><Ionicons name="navigate-outline" size={20} color={palette.brand} /></Pressable>
                    <Pressable accessibilityLabel="Modifica sede" onPress={() => openForm(site)} style={styles.iconAction}><Ionicons name="create-outline" size={20} color={palette.brand} /></Pressable>
                  </View>
                </Card>
              ))}
            </>
          ) : (
            <>
              <AppButton label="Torna alle sedi" icon="arrow-back-outline" variant="ghost" onPress={() => setFormOpen(false)} />
              <AppInput label="Nome completo *" value={name} onChangeText={setName} placeholder="Marilab Garbatella" />
              <AppInput label="Nome breve *" value={shortName} onChangeText={setShortName} placeholder="Garbatella" />
              <AppInput label="Indirizzo completo *" value={address} onChangeText={setAddress} placeholder="Via, numero civico, CAP, città" />
              <AppInput label="Ricerca Google Maps" value={mapsQuery} onChangeText={setMapsQuery} placeholder="Se vuoto viene usato l’indirizzo" />
              <View style={styles.twoColumns}>
                <View style={styles.column}><AppInput label="Referente" value={contactName} onChangeText={setContactName} placeholder="Facoltativo" /></View>
                <View style={styles.column}><AppInput label="Telefono" value={contactPhone} onChangeText={setContactPhone} keyboardType="phone-pad" placeholder="Facoltativo" /></View>
              </View>
              <ToggleChoice label="Sede attiva" value={active} onChange={setActive} />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <AppButton label={saving ? 'Salvataggio…' : editing ? 'Salva modifiche' : 'Crea sede'} icon="checkmark-circle-outline" disabled={saving} onPress={() => void submit()} />
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, minHeight: 0, width: '100%', backgroundColor: palette.background },
  header: { minHeight: 76, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: palette.border, backgroundColor: palette.surface },
  closeButton: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background },
  closePlaceholder: { width: 42 },
  headerText: { flex: 1, alignItems: 'center' },
  headerTitle: { color: palette.text, fontFamily: typography.display, fontSize: 19, fontWeight: '900' },
  headerSubtitle: { color: palette.textMuted, fontFamily: typography.body, fontSize: 11, marginTop: 2 },
  formScroll: { width: '100%', maxWidth: Platform.OS === 'web' ? 1440 : 900, alignSelf: 'center', padding: spacing.xl, paddingBottom: spacing.huge, gap: spacing.lg },
  twoColumns: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  column: { flex: 1, minWidth: Platform.OS === 'web' ? 320 : 230 },
  fieldTitle: { color: palette.text, fontFamily: typography.body, fontSize: 14, fontWeight: '800' },
  choiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  siteChoice: { minHeight: 44, maxWidth: 210, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  siteChoiceActive: { backgroundColor: palette.brand, borderColor: palette.brand },
  siteChoiceText: { color: palette.text, fontFamily: typography.body, fontSize: 12, fontWeight: '800', flexShrink: 1 },
  siteChoiceTextActive: { color: palette.white },
  toggleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  toggleChoice: { minHeight: 48, flex: 1, minWidth: 180, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  toggleChoiceActive: { borderColor: '#A9E3C6', backgroundColor: palette.successSoft },
  toggleChoiceText: { color: palette.textMuted, fontFamily: typography.body, fontSize: 13, fontWeight: '800' },
  toggleChoiceTextActive: { color: palette.success },
  error: { color: palette.danger, fontFamily: typography.body, fontSize: 13, fontWeight: '800' },
  siteCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  siteIcon: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.brandSoft },
  siteText: { flex: 1, gap: 3 },
  siteNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  siteName: { color: palette.text, fontFamily: typography.display, fontSize: 16, fontWeight: '900' },
  stateBadge: { color: palette.success, backgroundColor: palette.successSoft, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 4, fontFamily: typography.body, fontSize: 9, fontWeight: '900', overflow: 'hidden' },
  stateBadgeOff: { color: palette.danger, backgroundColor: palette.dangerSoft },
  siteFullName: { color: palette.textMuted, fontFamily: typography.body, fontSize: 12, fontWeight: '700' },
  siteAddress: { color: palette.text, fontFamily: typography.body, fontSize: 12, lineHeight: 17 },
  siteContact: { color: palette.brand, fontFamily: typography.body, fontSize: 11, fontWeight: '800' },
  siteActions: { gap: spacing.sm },
  iconAction: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, borderColor: '#BEDDFC', backgroundColor: palette.brandMist, alignItems: 'center', justifyContent: 'center' },
});
