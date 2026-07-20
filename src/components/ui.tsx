import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';

import { palette, radius, spacing, typography } from '@/constants/app-theme';
import { statusLabels } from '@/lib/format';
import type { RequestStatus } from '@/types/domain';

export function ScreenLoader() {
  return (
    <View style={styles.loader}>
      <ActivityIndicator size="large" color={palette.brand} />
      <Text style={styles.loaderText}>Preparazione di Marilab Mover…</Text>
    </View>
  );
}

export function Card({ children, style }: React.PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ title, action }: { title: string; action?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action ? <Text style={styles.sectionAction}>{action}</Text> : null}
    </View>
  );
}

interface ButtonProps {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  compact?: boolean;
}

export function AppButton({
  label,
  onPress,
  icon,
  variant = 'primary',
  disabled,
  compact,
}: ButtonProps) {
  const variantStyle = {
    primary: styles.buttonPrimary,
    secondary: styles.buttonSecondary,
    ghost: styles.buttonGhost,
    danger: styles.buttonDanger,
  }[variant];
  const textStyle = {
    primary: styles.buttonTextPrimary,
    secondary: styles.buttonTextSecondary,
    ghost: styles.buttonTextGhost,
    danger: styles.buttonTextDanger,
  }[variant];
  const iconColor = variant === 'primary' ? palette.white : variant === 'danger' ? palette.danger : palette.brand;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        variantStyle,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
      ]}>
      {icon ? <Ionicons name={icon} size={compact ? 18 : 20} color={iconColor} /> : null}
      <Text style={[styles.buttonText, textStyle]}>{label}</Text>
    </Pressable>
  );
}

function statusTone(status: RequestStatus) {
  if (status === 'completed' || status === 'delivered') {
    return { wrap: styles.statusSuccess, dot: palette.success, text: palette.success };
  }
  if (status === 'cancelled') {
    return { wrap: styles.statusDanger, dot: palette.danger, text: palette.danger };
  }
  if (status === 'pending') {
    return { wrap: styles.statusWarning, dot: palette.warning, text: '#8A5A00' };
  }
  if (status === 'in_transit' || status === 'picked_up') {
    return { wrap: styles.statusViolet, dot: palette.violet, text: palette.violet };
  }
  return { wrap: styles.statusInfo, dot: palette.info, text: palette.info };
}

export function StatusPill({ status }: { status: RequestStatus }) {
  const tone = statusTone(status);
  return (
    <View style={[styles.statusPill, tone.wrap]}>
      <View style={[styles.statusDot, { backgroundColor: tone.dot }]} />
      <Text style={[styles.statusText, { color: tone.text }]}>{statusLabels[status]}</Text>
    </View>
  );
}

export function AppInput({ label, error, style, ...props }: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={palette.textMuted}
        {...props}
        style={[styles.input, error ? styles.inputError : null, style]}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

export function ChoiceRow({
  label,
  value,
  onPress,
  icon = 'chevron-down',
}: {
  label: string;
  value: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable onPress={onPress} style={({ pressed }) => [styles.choice, pressed && styles.buttonPressed]}>
        <Text style={styles.choiceText} numberOfLines={1}>{value}</Text>
        <Ionicons name={icon} size={20} color={palette.textMuted} />
      </Pressable>
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  text,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  text: string;
}) {
  return (
    <Card style={styles.emptyCard}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={30} color={palette.brand} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.background,
    gap: spacing.lg,
  },
  loaderText: { color: palette.textMuted, fontSize: 15, fontFamily: typography.body },
  card: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(199,215,221,0.88)',
    padding: spacing.lg,
    shadowColor: palette.shadow,
    shadowOpacity: 0.075,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 7 },
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    marginTop: spacing.xs,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: palette.textStrong, fontFamily: typography.display, letterSpacing: -0.35 },
  sectionAction: { fontSize: 12, fontWeight: '900', color: palette.brand, fontFamily: typography.body, backgroundColor: palette.brandSoft, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill },
  button: {
    minHeight: 54,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
  },
  buttonCompact: { minHeight: 44, paddingHorizontal: spacing.md },
  buttonPrimary: { backgroundColor: palette.brandDark, borderColor: palette.brandDark },
  buttonSecondary: { backgroundColor: palette.brandSoft, borderColor: '#B7DDE7' },
  buttonGhost: { backgroundColor: palette.surface, borderColor: palette.border },
  buttonDanger: { backgroundColor: palette.dangerSoft, borderColor: '#F4C7C7' },
  buttonDisabled: { opacity: 0.45 },
  buttonPressed: { opacity: 0.74, transform: [{ scale: 0.985 }] },
  buttonText: { fontSize: 15, fontWeight: '800', fontFamily: typography.display, letterSpacing: -0.1 },
  buttonTextPrimary: { color: palette.white },
  buttonTextSecondary: { color: palette.brandDark },
  buttonTextGhost: { color: palette.brand },
  buttonTextDanger: { color: palette.danger },
  statusPill: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusSuccess: { backgroundColor: palette.successSoft },
  statusDanger: { backgroundColor: palette.dangerSoft },
  statusWarning: { backgroundColor: palette.warningSoft },
  statusInfo: { backgroundColor: palette.infoSoft },
  statusViolet: { backgroundColor: palette.violetSoft },
  statusText: { fontSize: 11, fontWeight: '900', fontFamily: typography.body, letterSpacing: 0.1 },
  field: { gap: spacing.sm },
  fieldLabel: { color: palette.text, fontSize: 14, fontWeight: '800', fontFamily: typography.body },
  input: {
    minHeight: 54,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#FBFDFD',
    color: palette.text,
    paddingHorizontal: spacing.lg,
    fontSize: 16,
    fontFamily: typography.body,
  },
  inputError: { borderColor: palette.danger },
  errorText: { color: palette.danger, fontSize: 12, fontWeight: '600', fontFamily: typography.body },
  choice: {
    minHeight: 54,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#FBFDFD',
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  choiceText: { color: palette.text, fontSize: 16, flex: 1, fontFamily: typography.body },
  emptyCard: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: palette.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyTitle: { color: palette.text, fontSize: 18, fontWeight: '800', fontFamily: typography.display },
  emptyText: { color: palette.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 21, fontFamily: typography.body },
});
