import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const amplitudeKey = env.AMPLITUDE_API_KEY || env.VITE_AMPLITUDE_API_KEY || '';

  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_AMPLITUDE_API_KEY': JSON.stringify(amplitudeKey),
    },
  };
});
