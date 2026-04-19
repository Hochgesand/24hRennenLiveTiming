# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

## Static deployment (no backend)

This app is a static frontend: there is no server component to run in production. Build once and host the output anywhere that serves static files.

1. **Build:** `npm run build` — output is written to `dist/`.
2. **Deploy:** upload or connect CI to publish the **contents** of `dist/` to [Netlify](https://www.netlify.com/), [Vercel](https://vercel.com/), [GitHub Pages](https://pages.github.com/), or any static host/CDN.

**End-to-end tests (Playwright):** Build first so `vite preview` can serve `dist/`, then run `npm run test:e2e`. In CI, run `npm run build` before `npm run test:e2e` (the Playwright `webServer` only starts preview; it does not build). Install browsers once with `npx playwright install chromium`.

**Client-side routing / SPA fallback:** If you use path-based client routing (for example `/event/123`) and users open or refresh a deep link, the host must rewrite unknown paths to `index.html` (HTTP 200 “rewrite”, not a redirect loop). If the live app is only ever loaded at `/` and state lives in the query string or hash, that rewrite is usually **not** required.

This repo includes optional Netlify SPA safety via `netlify.toml` (`[[redirects]]` from `/*` to `/index.html` with `status = 200`). On Netlify you can use that file **or** a `public/_redirects` file copied into `dist` with the same rule; for Vercel, configure equivalent rewrites in `vercel.json`; for GitHub Pages, use a [404 fallback](https://github.com/spa-github-pages/spa-github-pages) or project-specific `base` in Vite when not deploying at the domain root.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
