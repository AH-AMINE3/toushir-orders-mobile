import {Platform} from 'react-native';
import * as SecureStore from 'expo-secure-store';
export type PendingCash={amount:number;tendered:number;change:number;method:'CASH';idempotencyKey:string;reference:string};
const key=(id:string)=>`toushir-cash-${id}`;
export async function readPendingCash(id:string):Promise<PendingCash|null>{try{const value=Platform.OS==='web'?sessionStorage.getItem(key(id)):await SecureStore.getItemAsync(key(id));return value?JSON.parse(value):null;}catch{return null;}}
export async function savePendingCash(id:string,value:PendingCash){const raw=JSON.stringify(value);if(Platform.OS==='web')sessionStorage.setItem(key(id),raw);else await SecureStore.setItemAsync(key(id),raw);}
export async function clearPendingCash(id:string){if(Platform.OS==='web')sessionStorage.removeItem(key(id));else await SecureStore.deleteItemAsync(key(id));}
