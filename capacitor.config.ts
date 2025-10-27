import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',
  appName: 'myApp',
  webDir: 'www',
  plugins: {
    Filesystem: {
      // Permisos de almacenamiento para Android
      android: {
        permissions: ['READ_EXTERNAL_STORAGE', 'WRITE_EXTERNAL_STORAGE']
      }
    }
  }
};

export default config;
