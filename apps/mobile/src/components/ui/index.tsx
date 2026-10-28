import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, fonts, radius, space } from '../../lib/theme';

export type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

export function Icon({ name, size = 20, color = colors.text }: { name: IconName; size?: number; color?: string }) {
  return <MaterialCommunityIcons name={name} size={size} color={color} />;
}

type Variant = 'title' | 'h2' | 'h3' | 'body' | 'small' | 'muted' | 'label' | 'serif';

export function Txt({ variant = 'body', style, ...rest }: TextProps & { variant?: Variant }) {
  return <Text {...rest} style={[styles.base, textVariants[variant], style]} />;
}

const textVariants: Record<Variant, TextStyle> = {
  title: { fontFamily: fonts.serif, fontSize: 32, color: colors.gold, fontWeight: '700', letterSpacing: 0.5 },
  h2: { fontFamily: fonts.serif, fontSize: 22, color: colors.text, fontWeight: '700' },
  h3: { fontSize: 16, color: colors.text, fontWeight: '700' },
  body: { fontSize: 15, color: colors.text, lineHeight: 21 },
  small: { fontSize: 13, color: colors.text, lineHeight: 18 },
  muted: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  label: { fontSize: 11, color: colors.muted, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  serif: { fontFamily: fonts.serif, fontSize: 17, color: colors.parchment, lineHeight: 26 },
};

export function Screen({ children, scroll = true, style, padded = true }: { children: React.ReactNode; scroll?: boolean; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  const inner = padded ? { padding: space(4), gap: space(4) } : null;
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right', 'bottom']}>
      {scroll ? (
        <ScrollView contentContainerStyle={[styles.scrollContent, inner, style]} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, inner, style]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Header({ title, onBack, right }: { title: string; onBack?: () => void; right?: React.ReactNode }) {
  return (
    <View style={styles.header}>
      <IconButton icon="arrow-left" label="back" onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))} />
      <Txt variant="h2" style={{ flex: 1 }} numberOfLines={1}>
        {title}
      </Txt>
      {right}
    </View>
  );
}

type ButtonKind = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  title,
  onPress,
  kind = 'primary',
  icon,
  disabled,
  loading,
  style,
  small,
  testID,
}: {
  title: string;
  onPress?: () => void;
  kind?: ButtonKind;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
  testID?: string;
}) {
  const palette = {
    primary: { bg: colors.gold, fg: '#1b1408', border: colors.gold },
    secondary: { bg: colors.surface2, fg: colors.text, border: colors.border },
    ghost: { bg: 'transparent', fg: colors.text, border: colors.border },
    danger: { bg: 'transparent', fg: colors.red, border: colors.red },
  }[kind];
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={palette.fg} /> : icon ? <Icon name={icon} size={small ? 16 : 18} color={palette.fg} /> : null}
      <Text style={[styles.buttonText, small && { fontSize: 13 }, { color: palette.fg }]} numberOfLines={1}>
        {title}
      </Text>
    </Pressable>
  );
}

export function IconButton({ icon, onPress, label, active, color, testID }: { icon: IconName; onPress?: () => void; label: string; active?: boolean; color?: string; testID?: string }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.iconButton, active && { backgroundColor: colors.surface3, borderColor: colors.gold }, pressed && { opacity: 0.7 }]}
    >
      <Icon name={icon} size={20} color={color ?? (active ? colors.gold : colors.text)} />
    </Pressable>
  );
}

export function Card({ children, style, onPress, selected, testID }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: PressableProps['onPress']; selected?: boolean; testID?: string }) {
  const body = [styles.card, selected && { borderColor: colors.gold, backgroundColor: colors.surface2 }, style];
  if (!onPress) return <View style={body}>{children}</View>;
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [...body, pressed && { opacity: 0.85 }]}>
      {children}
    </Pressable>
  );
}

export function Chip({ label, selected, onPress, icon, tone, testID }: { label: string; selected?: boolean; onPress?: () => void; icon?: IconName; tone?: string; testID?: string }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && { borderColor: colors.gold, backgroundColor: colors.surface3 }, pressed && { opacity: 0.8 }]}
    >
      {icon ? <Icon name={icon} size={14} color={tone ?? (selected ? colors.gold : colors.muted)} /> : null}
      <Text style={[styles.chipText, { color: tone ?? (selected ? colors.gold : colors.text) }]}>{label}</Text>
    </Pressable>
  );
}

export function Bar({ value, max, color = colors.red, height = 6, style }: { value: number; max: number; color?: string; height?: number; style?: StyleProp<ViewStyle> }) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <View style={[{ height, backgroundColor: colors.surface3, borderRadius: height, overflow: 'hidden' }, style]}>
      <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: color, borderRadius: height }} />
    </View>
  );
}

export function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={{ gap: space(2) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Txt variant="label" style={{ flex: 1 }}>
          {title}
        </Txt>
        {right}
      </View>
      {children}
    </View>
  );
}

export function Row({ children, style, gap = 2 }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: space(gap) }, style]}>{children}</View>;
}

export function Centered({ children }: { children: React.ReactNode }) {
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space(6), gap: space(3) }}>{children}</View>;
}

export function Loading({ label }: { label?: string }) {
  return (
    <Centered>
      <ActivityIndicator color={colors.gold} />
      {label ? <Txt variant="muted">{label}</Txt> : null}
    </Centered>
  );
}

export function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <View style={styles.stat}>
      <Txt variant="label">{label}</Txt>
      <Txt variant="h2" style={{ fontSize: 20 }}>
        {value}
      </Txt>
      {sub ? <Txt variant="muted">{sub}</Txt> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { color: colors.text },
  screen: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { flexGrow: 1, width: '100%', maxWidth: 760, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  button: {
    minHeight: 46,
    paddingHorizontal: space(4),
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(2),
  },
  buttonSmall: { minHeight: 36, paddingHorizontal: space(3) },
  buttonText: { fontSize: 15, fontWeight: '700' },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: space(4), gap: space(2) },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(1),
    paddingHorizontal: space(3),
    paddingVertical: space(2),
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipText: { fontSize: 13, fontWeight: '600' },
  stat: { flex: 1, minWidth: 70, backgroundColor: colors.surface2, borderRadius: radius.md, padding: space(3), alignItems: 'center', gap: 2 },
});
