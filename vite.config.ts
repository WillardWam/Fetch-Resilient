import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import * as path from 'path'

export default defineConfig({
  plugins: [
    dts({ rollupTypes: true }),
  ],
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'ResilientHttpClient',
      fileName: (format) => `resilient-http-client.${format}.js`,
      formats: ['es', 'umd'],
    },
    rollupOptions: {
      external: [],
    },
    sourcemap: true,
    minify: 'terser',
    // terserOptions: {
    //   compress: {
    //     // This will preserve console logs
    //     pure_funcs: [],
    //     drop_debugger: false,
    //   },
    //   mangle: true,
    // },
  },
})