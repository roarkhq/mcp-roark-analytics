import { scopeAllowNetToWorkerSocket } from '../src/code-tool';

// Mirrors the arguments deno-http-worker builds: it appends its generated socket to
// any `--allow-read`/`--allow-write` flag we pass, then passes the bare path through
// to the bootstrap script.
const socketPath = '/tmp/2f0f9a2c-1111-2222-3333-444455556666-deno-http.sock';
const spawnArgs = [
  'run',
  '--node-modules-dir=manual',
  `--allow-read=/pkg,/pkg/node_modules,${socketPath}`,
  '--allow-net=api.roark.ai',
  '--allow-env',
  `--allow-write=${socketPath}`,
  'data:text/typescript,const%20socketFile',
  socketPath,
  'import',
  'file:///pkg/code-tool-worker.mjs',
];

describe('scopeAllowNetToWorkerSocket', () => {
  it('grants the worker socket without opening up other hosts', () => {
    const scoped = scopeAllowNetToWorkerSocket(spawnArgs);

    expect(scoped).toContain(`--allow-net=api.roark.ai,unix:${socketPath}`);
    expect(scoped).not.toContain('--allow-net');
  });

  it('leaves every other argument untouched', () => {
    const scoped = scopeAllowNetToWorkerSocket(spawnArgs);

    expect(scoped.filter((arg) => !arg.startsWith('--allow-net='))).toEqual(
      spawnArgs.filter((arg) => !arg.startsWith('--allow-net=')),
    );
  });

  it('fails closed when the socket path cannot be found', () => {
    expect(() => scopeAllowNetToWorkerSocket(spawnArgs.filter((arg) => arg !== socketPath))).toThrow(
      /socket path/,
    );
  });
});
