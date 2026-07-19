# BusBD V2.3 frontend source

`source.json.gz` contains the editable V2.3 React source bundle for `AppV23.tsx`, `api.ts`, `types.ts`, `main.tsx`, and `v23.css`. `npm run dev` and `npm run build` materialize those files before Vite starts. This keeps the restored V1 visual assets unchanged while applying the V2.3 application layer deterministically in CI and Docker builds.
