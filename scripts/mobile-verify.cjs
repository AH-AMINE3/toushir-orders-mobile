const fs=require('node:fs');
const path=require('node:path');
const config=require('../app.config');
const role=process.env.EXPO_PUBLIC_APP_ROLE==='DRIVER'?'DRIVER':'MERCHANT';
const expected=role==='DRIVER'?'com.toushir.livreur':'com.toushir.commerce';
if(config.android.package!==expected||config.ios.bundleIdentifier!==expected)throw Error('Native variant identifier mismatch');
if(config.experiments.baseUrl!=='/mobile')throw Error('Wrong browser base URL');
for(const p of ['assets/DMSans.ttf','assets/icon.png','assets/driver-icon.png'])if(!fs.statSync(path.resolve(__dirname,'..',p)).size)throw Error('Missing asset: '+p);
console.log(`${role} variant: ${config.name}, ${expected}, /mobile; required assets present`);
const native=process.argv[process.argv.indexOf('--native')+1];
if(process.argv.includes('--native')){
 if(native==='android'){
  const gradle=fs.readFileSync(path.resolve(__dirname,'../android/app/build.gradle'),'utf8');
  if(!new RegExp(`applicationId ['\"]${expected.replaceAll('.','\\.')}['\"]`).test(gradle))throw Error('Generated Android application ID does not match selected role; run Expo prebuild.');
  if(!gradle.includes('@toushir-private-signing-start'))throw Error('Private signing config plugin missing from generated project');
 }else if(native==='ios'){
  const ios=path.resolve(__dirname,'../ios'),project=fs.readdirSync(ios).find(p=>p.endsWith('.xcodeproj'));
  if(!project||!fs.readFileSync(path.join(ios,project,'project.pbxproj'),'utf8').match(new RegExp(`PRODUCT_BUNDLE_IDENTIFIER = [\"]?${expected.replaceAll('.', '\\.')}[\"]?;`)))throw Error('Generated iOS identifier does not match selected role; run Expo prebuild.');
 }else throw Error('Native verification platform must be android or ios');
 console.log(`${native} generated project matches ${role}`);
}
