const {withAndroidManifest}=require('expo/config-plugins');
module.exports=function withLocalHttp(config){
 let local=false;
 try{
  const url=new URL(process.env.EXPO_PUBLIC_API_URL||'');
  const host=url.hostname;
  local=url.protocol==='http:'&&(host==='localhost'||host==='127.0.0.1'||/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)||/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)||/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host));
 }catch{}
 return withAndroidManifest(config,c=>{const app=c.modResults.manifest.application?.[0];if(app){if(local)app.$['android:usesCleartextTraffic']='true';else delete app.$['android:usesCleartextTraffic'];}return c;});
};
