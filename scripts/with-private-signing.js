const {withAppBuildGradle}=require('expo/config-plugins');
const block=`// @toushir-private-signing-start
// Credentials are read at build time, never serialized by Expo prebuild.
if (System.getenv('TOUSHIR_RELEASE_SIGNING') == '1') {
    def required = ['TOUSHIR_SIGNING_STORE_FILE', 'TOUSHIR_SIGNING_STORE_PASSWORD', 'TOUSHIR_SIGNING_KEY_ALIAS', 'TOUSHIR_SIGNING_KEY_PASSWORD']
    if (required.any { !System.getenv(it) }) {
        throw new GradleException('Private release signing requires all TOUSHIR_SIGNING_* variables.')
    }
    android.signingConfigs.create('toushirRelease') {
        storeFile file(System.getenv('TOUSHIR_SIGNING_STORE_FILE'))
        storePassword System.getenv('TOUSHIR_SIGNING_STORE_PASSWORD')
        keyAlias System.getenv('TOUSHIR_SIGNING_KEY_ALIAS')
        keyPassword System.getenv('TOUSHIR_SIGNING_KEY_PASSWORD')
    }
    android.buildTypes.release.signingConfig = android.signingConfigs.toushirRelease
}
// Public build identity must invalidate Metro's Gradle task when the API or
// launcher changes; otherwise Gradle can reuse a bundle from another preview.
tasks.configureEach { task ->
    if (task.name.startsWith('createBundle') && task.name.endsWith('JsAndAssets')) {
        task.inputs.property('toushirPublicApiOrigin', System.getenv('EXPO_PUBLIC_API_URL') ?: '')
        task.inputs.property('toushirAppRole', System.getenv('EXPO_PUBLIC_APP_ROLE') ?: 'MERCHANT')
    }
}
// @toushir-private-signing-end`;
module.exports=function withPrivateSigning(config){return withAppBuildGradle(config,c=>{if(c.modResults.language!=='groovy')throw Error('Toushir private signing requires a Groovy Android app build.');c.modResults.contents=c.modResults.contents.replace(/\n?\/\/ @toushir-private-signing-start[\s\S]*?\/\/ @toushir-private-signing-end\n?/g,'\n').trimEnd()+'\n\n'+block+'\n';return c;});};
