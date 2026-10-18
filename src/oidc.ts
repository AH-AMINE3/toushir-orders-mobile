import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';
import {Platform} from 'react-native';
import {api,API_ORIGIN,Session,setBearer} from './api';
import {launchRole} from './runtime';
WebBrowser.maybeCompleteAuthSession();
const clientId='toushir-mobile';
const issuerOrigin=()=>API_ORIGIN||(Platform.OS==='web'?window.location.origin:'');
const getSecret=(key:string)=>Platform.OS==='web'?Promise.resolve(sessionStorage.getItem(key)):SecureStore.getItemAsync(key);
const putSecret=(key:string,value:string)=>Platform.OS==='web'?Promise.resolve(sessionStorage.setItem(key,value)):SecureStore.setItemAsync(key,value);
const eraseSecret=(key:string)=>Platform.OS==='web'?Promise.resolve(sessionStorage.removeItem(key)):SecureStore.deleteItemAsync(key);
const redirectUri=()=>Platform.OS==='web'?window.location.origin+'/mobile/auth/callback':AuthSession.makeRedirectUri({scheme:launchRole()==='DRIVER'?'toushirlivreur':'toushircommerce',path:'auth/callback'});
const keys=['toushir-oidc-access','toushir-oidc-refresh','toushir-oidc-expires'];
let renewal:Promise<string|null>|null=null;
let discovery:AuthSession.DiscoveryDocument|null=null;
async function discover(){if(!issuerOrigin())throw new Error('L’adresse du serveur de connexion doit être configurée pour cette application.');return discovery??=await AuthSession.fetchDiscoveryAsync(issuerOrigin());}
async function persist(tokens:AuthSession.TokenResponse){await putSecret(keys[0],tokens.accessToken);if(tokens.refreshToken)await putSecret(keys[1],tokens.refreshToken);await putSecret(keys[2],String((tokens.issuedAt+(tokens.expiresIn||3600))*1000));setBearer(tokens.accessToken);return tokens.accessToken;}
export function useOidcLogin(){
 const issuer=AuthSession.useAutoDiscovery(issuerOrigin());
 const callback=redirectUri();
 const [request,,promptAsync]=AuthSession.useAuthRequest({clientId,redirectUri:callback,responseType:AuthSession.ResponseType.Code,scopes:['openid','profile','email','commerce_api','offline_access'],usePKCE:true,codeChallengeMethod:AuthSession.CodeChallengeMethod.S256},issuer);
 async function signIn():Promise<Session>{
  if(!request||!issuer)throw new Error('La connexion se prépare. Réessayez dans un instant.');
  const result=await promptAsync();
  if(result.type!=='success')throw new Error(result.type==='error'?'La connexion a été refusée par le serveur. Réessayez.':'Connexion annulée. Vous pouvez réessayer.');
  if(!request.codeVerifier||!result.params.code)throw new Error('La preuve de connexion est incomplète. Recommencez la connexion.');
  const tokens=await AuthSession.exchangeCodeAsync({clientId,redirectUri:callback,code:result.params.code,extraParams:{code_verifier:request.codeVerifier}},issuer);
  await persist(tokens);
  const session=await api<Session>('/auth/me');
  if(session.user.role!==launchRole()){await signOutNative();setBearer('');throw new Error(launchRole()==='DRIVER'?'Ce compte n’est pas un compte livreur. Utilisez le compte affecté par votre grossiste.':'Ce compte n’est pas un compte commerçant. Ouvrez l’espace web correspondant.');}
  return {...session,token:tokens.accessToken};
 }
 return {signIn,ready:!!request&&!!issuer};
}
export async function restoreNativeAccess(force=false):Promise<string|null>{

 if(renewal)return renewal;
 renewal=(async()=>{const[access,refresh,expires]=await Promise.all(keys.map(k=>getSecret(k)));if(!access)return null;if(!force&&Number(expires)>Date.now()+60000)return access;if(!refresh)return null;const tokens=await AuthSession.refreshAsync({clientId,refreshToken:refresh},await discover());return persist(tokens);})();
 try{return await renewal;}finally{renewal=null;}
}
export async function signOutNative(){const refresh=await getSecret(keys[1]);try{if(refresh){const endpoints=await discover();if(endpoints.revocationEndpoint)await AuthSession.revokeAsync({clientId,token:refresh,tokenTypeHint:AuthSession.TokenTypeHint.RefreshToken},endpoints);}}finally{await Promise.all(keys.map(k=>eraseSecret(k)));}}
