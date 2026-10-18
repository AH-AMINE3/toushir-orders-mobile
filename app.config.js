const base = require('./app.json').expo;
const driver = process.env.EXPO_PUBLIC_APP_ROLE === 'DRIVER';
module.exports = { ...base,
  name: driver ? 'Toushir Livreur' : 'Toushir Commerce',
  slug: driver ? 'toushir-livreur' : 'toushir-commerce',
  scheme: driver ? 'toushirlivreur' : 'toushircommerce',
  icon: driver ? './assets/driver-icon.png' : './assets/icon.png',
  ios: { ...base.ios, supportsTablet: false, bundleIdentifier: driver ? 'com.toushir.livreur' : 'com.toushir.commerce' },
  android: { ...base.android, package: driver ? 'com.toushir.livreur' : 'com.toushir.commerce', adaptiveIcon: { foregroundImage: driver ? './assets/driver-icon.png' : './assets/icon.png', backgroundColor: '#FFFFFF' } },
  web: { ...base.web, name: 'Toushir Commerce', shortName: 'Toushir', themeColor: '#FFFFFF', backgroundColor: '#FFFFFF' },
  experiments: { baseUrl: '/mobile' },
  plugins: ['./scripts/with-local-http','./scripts/with-private-signing','expo-font','expo-secure-store','expo-image','expo-web-browser', ['expo-location', {locationWhenInUsePermission: 'Partagez votre position pendant votre tournée pour que le commerçant puisse suivre sa livraison.'}], ['expo-camera',{cameraPermission:'Scannez le QR de réception présenté par le commerçant.',recordAudioAndroid:false}]],
  extra: { appRole: driver ? 'DRIVER' : 'MERCHANT' }
};
