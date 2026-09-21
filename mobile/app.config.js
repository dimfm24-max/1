const googleIosUrlScheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME?.trim();

const plugins = [
  'expo-router',
  'expo-font',
  'expo-image',
  [
    // Photo library only. The camera and microphone flags are false on purpose so the generated
    // manifests do not claim permissions this app never uses - check Info.plist and
    // AndroidManifest.xml after a prebuild if you change this.
    'expo-image-picker',
    {
      cameraPermission: false,
      microphonePermission: false,
      photosPermission: 'Allow $(PRODUCT_NAME) to access your photos so you can set a profile photo.',
    },
  ],
  [
    'expo-splash-screen',
    {
      backgroundColor: '#208AEF',
      android: {
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
      },
    },
  ],
  'expo-secure-store',
  'expo-notifications',
  'expo-status-bar',
  'expo-apple-authentication',
];

if (googleIosUrlScheme) {
  plugins.push([
    '@react-native-google-signin/google-signin',
    {
      iosUrlScheme: googleIosUrlScheme,
    },
  ]);
}

module.exports = {
  expo: {
    name: 'DiLife',
    owner: 'dmitriy12',
    slug: 'vibe',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'dilife',
    userInterfaceStyle: 'automatic',
    ios: {
      bundleIdentifier: 'com.dilife.app',
      icon: './assets/expo.icon',
      usesAppleSignIn: true,
    },
    android: {
      package: 'com.dilife.app',
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
    },
    web: {
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins,
    extra: {
      eas: {
        projectId: 'fff81b52-05a7-4ee7-b56d-0d3ea02472af',
      },
    },
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
  },
};
