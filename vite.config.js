import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const mock = (file) => fileURLToPath(new URL(`./src/mock/${file}`, import.meta.url));

// base './' + HashRouter = funciona en GitHub Pages sea cual sea el nombre del repo
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());
  // MODO DEMO: si no hay configuración de Firebase en .env, se usa una simulación
  // local (datos en localStorage). En cuanto rellenes el .env, se usa Firebase real.
  const demo = !env.VITE_FIREBASE_API_KEY;
  if (demo) console.log('\n  ⚠️  Sin .env de Firebase → MODO DEMO con datos locales\n');

  return {
    plugins: [react()],
    base: '/infinity_tenis/',
    define: { __DEMO_MODE__: demo },
    resolve: {
      alias: demo
        ? {
            'firebase/app': mock('firebase-app.js'),
            'firebase/auth': mock('firebase-auth.js'),
            'firebase/firestore': mock('firebase-firestore.js'),
          }
        : {},
    },
  };
});
