// Generates the PNG app icons from frontend/public/favicon.svg.
// Only needed when the logo changes:  npx @vite-pwa/assets-generator
import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

const brand = '#0b5a72';

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: brand } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: brand } },
  },
  images: ['frontend/public/favicon.svg'],
});
