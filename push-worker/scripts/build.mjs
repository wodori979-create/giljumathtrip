import {build} from 'rolldown';
import {fileURLToPath} from 'node:url';
await build({input:fileURLToPath(new URL('../src/index.ts',import.meta.url)),platform:'browser',output:{file:fileURLToPath(new URL('../../work/push-worker/index.mjs',import.meta.url)),format:'esm',minify:true}});
console.log('Bundled standalone push Worker.');
