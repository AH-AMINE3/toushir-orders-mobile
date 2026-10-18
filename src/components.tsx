import React, { useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C, S } from './theme';
import { imageUrl, statuses } from './api';

export const Icon = ({ name, size = 20, color = C.ink }: { name: string; size?: number; color?: string }) => <Ionicons aria-hidden={true} accessibilityElementsHidden={true} accessible={false} importantForAccessibility="no-hide-descendants" name={name as any} size={size} color={color} />;
export function Button({ children, onPress, variant = 'primary', icon, loading, disabled, small, style, label }: { children?: React.ReactNode; onPress?: () => void; variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'lime' | 'ink'; icon?: string; loading?: boolean; disabled?: boolean; small?: boolean; style?: ViewStyle; label?: string }) {
  const [focus, setFocus] = useState(false);
  const [hover, setHover] = useState(false);
  const bg = variant === 'ink' ? C.ink : variant === 'primary' || variant === 'lime' ? C.action : variant === 'danger' ? C.redBg : variant === 'secondary' ? C.pale : 'transparent';
  const fg = variant === 'ink' ? C.white : variant === 'danger' ? C.red : C.ink;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled || !!loading, busy: !!loading }} disabled={disabled || loading} onPress={onPress} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} onHoverIn={() => setHover(true)} onHoverOut={() => setHover(false)} style={({ pressed }) => [S.button, { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.7 : hover ? 0.86 : 1, borderWidth: focus ? 2 : 0, borderColor: C.green, ...(small ? { minHeight: 38, paddingVertical: 7, paddingHorizontal: 12 } : {}) }, style]}>
    {loading ? <ActivityIndicator size="small" color={fg} /> : icon ? <Icon name={icon} size={small ? 16 : 18} color={fg} /> : null}
    {children != null && <Text style={[S.buttonText, { color: fg, flexShrink: 1, textAlign: 'center' }]}>{children}</Text>}
  </Pressable>;
}
export function FilterPill({children,selected,onPress}:{children:React.ReactNode;selected:boolean;onPress:()=>void}) {
  return <Pressable accessibilityRole="button" accessibilityState={{selected}} onPress={onPress} style={({pressed})=>({minHeight:44,justifyContent:'center',opacity:pressed?.7:1})}><View style={{borderRadius:24,backgroundColor:selected?C.ink:C.bg,paddingHorizontal:14,minHeight:36,justifyContent:'center'}}><Text style={[S.label,{fontSize:13,lineHeight:18,color:selected?C.white:C.muted}]}>{children}</Text></View></Pressable>;
}
export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  const [focus, setFocus] = useState(false);
  return <View style={{ gap: 7, flex: props.style ? undefined : 1 }}><Text style={S.label}>{label}</Text><TextInput {...props} accessibilityLabel={label} placeholderTextColor={C.muted} onFocus={e => { setFocus(true); props.onFocus?.(e); }} onBlur={e => { setFocus(false); props.onBlur?.(e); }} style={[S.input, { borderColor: error ? C.red : focus ? C.green : C.border }, props.multiline ? { minHeight: 90, textAlignVertical: 'top' } : {}, props.style]} />{error ? <Text style={[S.small, { color: C.red }]}>{error}</Text> : null}</View>;
}
export function Logo({ light = false, small = false }: { light?: boolean; small?: boolean }) {
  return <Image accessibilityLabel="Toushir" source={require('../assets/logo.png')} style={{ width: small ? 115 : 145, height: small ? 29 : 36, tintColor: light ? C.white : C.ink }} resizeMode="contain" />;
}
export function ProductImage({ uri, name, size, style }: { uri?: string; name: string; size?: number; style?: ViewStyle }) {
  const [failed, setFailed] = useState(false);
  React.useEffect(() => setFailed(false), [uri]);
  return <View style={[{ backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', ...(size ? { width: size, height: size } : { width: '100%', aspectRatio: 1 }) }, style]}>{uri && !failed ? <Image source={{ uri: imageUrl(uri) }} accessibilityLabel={name} onError={() => setFailed(true)} resizeMode="contain" style={{ width: '84%', height: '84%' }} /> : <View style={{ alignItems: 'center', padding: 8, gap: 5 }}><Icon name="image-outline" color={C.muted} size={30} /><Text style={[S.small, { textAlign: 'center', fontSize: 10 }]}>Photo à vérifier</Text></View>}</View>;
}
export function Status({ value }: { value: string }) {
  const danger = ['CANCELLED', 'REJECTED', 'DECLINED', 'SUSPENDED', 'DELIVERY_REFUSED'].includes(value);
  const pending = ['REQUESTED', 'QUOTED', 'PENDING', 'UNPAID', 'PARTIAL'].includes(value);
  const blue = ['OUT_FOR_DELIVERY', 'PREPARING', 'READY'].includes(value);
  const bg = danger ? C.redBg : pending ? C.amberBg : blue ? C.blueBg : C.pale;
  const fg = danger ? C.red : pending ? C.amber : blue ? C.blue : C.green;
  return <View style={{ backgroundColor: bg, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 7, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6 }}><View style={{ width: 5, height: 5, backgroundColor: fg, borderRadius: 3 }} /><Text style={[S.small, { color: fg, fontWeight: '700' }]}>{statuses[value] || value}</Text></View>;
}
export function Notice({ children, error = false }: { children: React.ReactNode; error?: boolean }) {
  return <View accessibilityRole={error ? 'alert' : undefined} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 9, backgroundColor: error ? C.redBg : C.pale, padding: 14, borderRadius: 12 }}><Icon name={error ? 'alert-circle-outline' : 'information-circle-outline'} color={error ? C.red : C.green} size={18} /><Text style={[S.muted, { color: error ? C.red : C.green, flex: 1 }]}>{children}</Text></View>;
}
export function Empty({ title, message, icon = 'cube-outline', action }: { title: string; message: string; icon?: string; action?: React.ReactNode }) {
  return <View style={{ paddingVertical: 52, paddingHorizontal: 24, alignItems: 'center', gap: 13 }}><View style={{ width: 70, height: 70, borderRadius: 24, backgroundColor: C.pale, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={30} color={C.green} /></View><Text style={[S.subheading, { textAlign: 'center' }]}>{title}</Text><Text style={[S.muted, { textAlign: 'center', maxWidth: 370 }]}>{message}</Text>{action}</View>;
}
export function Loading({ count = 6 }: { count?: number }) {
  return <View accessibilityLabel="Chargement des informations" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>{Array.from({ length: count }).map((_, i) => <View key={i} style={{ minWidth: 145, flex: 1, height: 230, backgroundColor: C.white, borderRadius: 16, padding: 16 }}><View style={{ height: 125, backgroundColor: C.pale, borderRadius: 10 }} /><View style={{ width: '70%', height: 14, backgroundColor: C.pale, marginTop: 19, borderRadius: 4 }} /><View style={{ width: '45%', height: 12, backgroundColor: C.pale, marginTop: 10, borderRadius: 4 }} /></View>)}</View>;
}
export function Stepper({ value, onChange, minimum = 1, compact = false }: { value: number; onChange: (n: number) => void; minimum?: number; compact?: boolean }) {
  return <View style={{ flexDirection: 'row', borderWidth: 1, borderColor: C.border, borderRadius: 10, alignItems: 'center', backgroundColor: C.white }}><Button label="Diminuer la quantité" icon={value <= minimum ? 'trash-outline' : 'remove'} variant="ghost" small={compact} onPress={() => onChange(value <= minimum ? 0 : Math.max(minimum, value - minimum))} style={{ paddingHorizontal: 9, minHeight: compact ? 36 : 44 }} /><Text accessibilityLabel={`Quantité ${value}`} style={[S.label, { minWidth: 24, textAlign: 'center', fontSize: 14 }]}>{value}</Text><Button label="Augmenter la quantité" icon="add" variant="ghost" small={compact} onPress={() => onChange(value + minimum)} style={{ paddingHorizontal: 9, minHeight: compact ? 36 : 44 }} /></View>;
}
