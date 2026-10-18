import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { api, date, operationKey, post } from "./api";
import { Button, Icon, Notice } from "./components";
import { C, S } from "./theme";

/** In-app safety instructions for the current primary shop or the named driver. Receipt is separate from recovery. */
export default function Recalls({ revision = 0, canAcknowledge = true }: { revision?: number; canAcknowledge?: boolean }) {
  const [items,setItems]=useState<any[]|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState("");
  const keys=useRef<Record<string,string>>({});
  const load=async()=>{setError("");try{const data=await api("/recalls/inbox");setItems(data.items);}catch(e:any){setError(e.message);}};
  useEffect(()=>{let active=true;api("/recalls/inbox").then(data=>{if(active)setItems(data.items);}).catch(e=>{if(active)setError(e.message);});const timer=setInterval(()=>{if(active)load();},15000);return()=>{active=false;clearInterval(timer);};},[revision]);
  const acknowledge=async(notice:any)=>{setBusy(notice.id);setError("");try{const data=await post(`/recalls/notices/${notice.id}/ack`,{version:notice.version,idempotencyKey:keys.current[notice.id] ||= operationKey()});setItems(data.items);}catch(e:any){setError(e.message);}finally{setBusy("");}};
  if(items?.length===0&&!error)return null;
  return <View style={R.section}>
    <View style={S.row}><Icon name="shield-checkmark-outline" color={C.green}/><Text style={S.subheading}>Consignes de sécurité</Text></View>
    {error?<><Notice error>{error}</Notice><Button variant="secondary" small onPress={load}>Actualiser les consignes</Button></>:null}
    {!items&&!error?<View accessibilityLabel="Chargement des consignes" style={R.loading}><View style={R.loadingLine}/><View style={[R.loadingLine,{width:"75%"}]}/></View>:items?.map(item=><View key={item.notice.id} style={R.instruction}>
      <View style={S.between}><Text style={[S.label,{color:C.green}]}>Lot {item.recall.lotNumber}</Text><Text style={S.small}>{item.recall.status==="ACTIVE"?"Rappel actif":"Blocage maintenu"}</Text></View>
      <Text style={S.text}>{item.recall.safetyInstruction}</Text>
      <Text style={S.muted}>Stoppez l’utilisation et la circulation des unités concernées. Suivez la consigne pour organiser leur reprise.</Text>
      {item.positions.map((position:any)=><View key={position.id} style={R.position}><Text style={S.small}>{position.kind==="PREPARATION"?"Préparation suspendue":"Quantité expédiée concernée"}</Text><Text style={S.label}>{position.quantity} unités</Text></View>)}
      <Text style={S.small}>Confirmer la réception de la consigne ne confirme ni son application ni une récupération physique.</Text>
      {item.notice.receivedAt?<View style={R.received}><Icon name="checkmark-circle-outline" color={C.green} size={18}/><Text style={[S.small,{color:C.green,flex:1}]}>Consigne reçue le {date(item.notice.receivedAt)}. La récupération physique reste suivie séparément.</Text></View>:canAcknowledge?<Button loading={busy===item.notice.id} disabled={!!busy} onPress={()=>acknowledge(item.notice)}>J’ai reçu la consigne</Button>:<Text style={S.muted}>Le propriétaire ou un membre autorisé du magasin peut confirmer la réception.</Text>}
    </View>)}
  </View>;
}
const R=StyleSheet.create({section:{gap:16},instruction:{backgroundColor:C.white,borderWidth:1,borderColor:C.border,borderRadius:14,padding:20,gap:15},position:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",gap:12,paddingVertical:12,borderTopWidth:1,borderColor:C.border},received:{flexDirection:"row",gap:9,alignItems:"flex-start",backgroundColor:C.pale,borderRadius:9,padding:12},loading:{height:110,gap:14,padding:20,backgroundColor:C.white,borderRadius:12},loadingLine:{height:16,width:"55%",backgroundColor:C.pale,borderRadius:4}});
