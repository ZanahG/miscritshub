import { serve, file } from 'bun';
import { join } from 'path';

const BASE_DIR = import.meta.dir;

serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    let path = url.pathname;
    if (path === '/') path = '/index.html';

    // 2. Transpile .js or .ts requests
    if (path.endsWith('.js') || path.endsWith('.ts')) {
      const tsPath = join(BASE_DIR, path.replace(/\.js$/, '.ts'));
      const tsFile = file(tsPath);
      if (await tsFile.exists()) {
        const build = await Bun.build({
          entrypoints: [tsPath],
          sourcemap: 'inline'
        });
        if (build.success && build.outputs?.length > 0) {
          return new Response(build.outputs[0].stream(), {
            headers: { 'Content-Type': 'application/javascript' }
          });
        } else {
          console.error(`Build failed for ${tsPath}:`, build.logs);
        }
      }
    }

    // 1. Try serving the exact file requested
    const exactFile = file(join(BASE_DIR, path));
    if (await exactFile.exists()) {
      return new Response(exactFile);
    }

    // 3. Not found
    return new Response('Not found', { status: 404 });
  }
});

console.log('⚡ Bun dev server running at http://localhost:3000');
