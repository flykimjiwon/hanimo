import { execSync } from 'node:child_process';
import { copyFileSync } from 'node:fs';
import { platform } from 'node:os';

console.log('=== hanimo single binary builder ===');

// 1. Bundle with esbuild
console.log('[1/3] Bundling with esbuild...');
execSync('node scripts/build-binary.mjs', { stdio: 'inherit' });

// 2. Generate SEA blob
console.log('[2/3] Generating SEA blob...');
execSync('node --experimental-sea-config sea.config.json', { stdio: 'inherit' });

// 3. Copy node binary and inject blob
console.log('[3/3] Creating binary...');

const isWin = platform() === 'win32';
const binaryName = isWin ? 'dist\\hanimo.exe' : 'dist/hanimo';

// Copy current node binary
copyFileSync(process.execPath, binaryName);

// Inject SEA blob
const postjectCmd = [
  'npx postject',
  `"${binaryName}"`,
  'NODE_SEA_BLOB',
  'dist/sea-prep.blob',
  '--sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2',
].join(' ');
execSync(postjectCmd, { stdio: 'inherit' });

// macOS: re-sign the binary
if (platform() === 'darwin') {
  console.log('Signing binary (macOS)...');
  execSync(`codesign --sign - "${binaryName}"`, { stdio: 'inherit' });
}

console.log('');
console.log(`Binary built: ${binaryName}`);
