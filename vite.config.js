import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  base: "/CCFP_Noise_Crafted_Dimensions/",
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        app: resolve(__dirname, 'index.html'),
        howto: resolve(__dirname, 'howto/index.html'),
      },
    },
  },
});