import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/cli.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: 'dist/hanimo-bundle.mjs',
  sourcemap: false,
  minify: true,
  // Externalize native addons and packages that don't bundle cleanly.
  // ink, react, yoga-layout are bundled so TUI works in binary builds.
  external: [
    'better-sqlite3',
    'fsevents',
  ],
  // Stub out optional dev-only packages that aren't installed
  alias: {
    'react-devtools-core': './scripts/stubs/empty.mjs',
  },
  banner: {
    js: [
      // Polyfill __dirname, __filename, and require for ESM
      'import { fileURLToPath as __fileURLToPath } from "node:url";',
      'import { dirname as __dirname_fn } from "node:path";',
      'import { createRequire as __createRequire } from "node:module";',
      'const __filename = __fileURLToPath(import.meta.url);',
      'const __dirname = __dirname_fn(__filename);',
      'const require = __createRequire(import.meta.url);',
    ].join('\n'),
  },
});

console.log('Bundle built: dist/hanimo-bundle.mjs');
