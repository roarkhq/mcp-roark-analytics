import { denoAcceptsUnixAllowNet, scopeAllowNetToWorkerSocket } from '../src/code-tool';

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
  describe('on a Deno that requires the socket in --allow-net (2.9+)', () => {
    it('grants the worker socket without opening up other hosts', () => {
      const scoped = scopeAllowNetToWorkerSocket(spawnArgs, true);

      expect(scoped).toContain(`--allow-net=api.roark.ai,unix:${socketPath}`);
      expect(scoped).not.toContain('--allow-net');
    });

    it('leaves every other argument untouched', () => {
      const scoped = scopeAllowNetToWorkerSocket(spawnArgs, true);

      expect(scoped.filter((arg) => !arg.startsWith('--allow-net='))).toEqual(
        spawnArgs.filter((arg) => !arg.startsWith('--allow-net=')),
      );
    });
  });

  /* The regression. Deno 2.7 parses every --allow-net entry as `host[:port]`, so a
     `unix:` entry is read as host `unix` with port `/tmp/...` and Deno exits with
     "invalid port" before serving anything - which reaches the caller only as the
     much vaguer "Deno exited before being ready". */
  describe('on a Deno that rejects a unix: entry (2.7 and earlier)', () => {
    it('leaves --allow-net alone, since read/write already grant the socket', () => {
      const scoped = scopeAllowNetToWorkerSocket(spawnArgs, false);

      expect(scoped).toEqual(spawnArgs);
      expect(scoped.some((arg) => arg.includes('unix:'))).toBe(false);
    });
  });

  it.each([true, false])('fails closed when the socket path cannot be found (allow-net: %s)', (addToNet) => {
    expect(() =>
      scopeAllowNetToWorkerSocket(
        spawnArgs.filter((arg) => arg !== socketPath),
        addToNet,
      ),
    ).toThrow(/socket path/);
  });

  /* Every supported Deno gates the socket on read AND write of its path. If a future
     deno-http-worker stops granting either, the worker dies at runtime with a
     permission error, so catch it at spawn time with a message that names the flag. */
  it.each(['--allow-read=', '--allow-write='])('fails closed when %s does not grant the socket', (flag) => {
    const withoutGrant = spawnArgs.map((arg) =>
      arg.startsWith(flag) ?
        `${flag}${arg
          .slice(flag.length)
          .split(',')
          .filter((entry) => entry !== socketPath)
          .join(',')}`
      : arg,
    );

    expect(() => scopeAllowNetToWorkerSocket(withoutGrant, true)).toThrow(new RegExp(flag));
  });

  /* A substring match would accept `--allow-read=/tmp/other-deno-http.sock` as a grant
     for our socket, so the check splits on commas and compares whole entries. */
  it('does not accept a different socket as the grant', () => {
    const otherSocket = '/tmp/99999999-0000-0000-0000-000000000000-deno-http.sock';
    const withOtherSocket = spawnArgs.map((arg) =>
      arg.startsWith('--allow-write=') ? `--allow-write=${otherSocket}` : arg,
    );

    expect(() => scopeAllowNetToWorkerSocket(withOtherSocket, true)).toThrow(/--allow-write=/);
  });
});

describe('denoAcceptsUnixAllowNet', () => {
  it('reports support when the probe is accepted, and passes the flag being tested', () => {
    const probe = jest.fn().mockReturnValue({ status: 0 });

    expect(denoAcceptsUnixAllowNet('/new/deno', probe)).toBe(true);
    expect(probe).toHaveBeenCalledWith(
      '/new/deno',
      expect.arrayContaining([expect.stringMatching(/^--allow-net=unix:/)]),
    );
  });

  it('reports no support when the probe is rejected', () => {
    expect(denoAcceptsUnixAllowNet('/old/deno', () => ({ status: 1 }))).toBe(false);
  });

  it('reports no support when the probe cannot run at all', () => {
    expect(denoAcceptsUnixAllowNet('/missing/deno', () => ({ status: null }))).toBe(false);
  });

  /* A null status is "the probe never ran" (spawn failure, timeout, signal), not "this
     Deno rejects the flag" - that is an exit code. Caching it would pin the answer for
     the life of the process, and on Deno 2.9+ one transient failure would then make
     every later execute call die with NotCapable. */
  it('does not cache a probe that never ran, so a transient failure is not permanent', () => {
    const probe = jest.fn().mockReturnValueOnce({ status: null }).mockReturnValueOnce({ status: 0 });

    expect(denoAcceptsUnixAllowNet('/flaky/deno', probe)).toBe(false);
    expect(denoAcceptsUnixAllowNet('/flaky/deno', probe)).toBe(true);
    expect(probe).toHaveBeenCalledTimes(2);
  });

  /* A Deno that ran and rejected the flag is a settled answer, so it must still be
     cached - otherwise every execute call on 2.7 pays for another spawn. */
  it('caches a rejection, which is an answer rather than a failure', () => {
    const probe = jest.fn().mockReturnValue({ status: 1 });

    denoAcceptsUnixAllowNet('/old-cached/deno', probe);
    denoAcceptsUnixAllowNet('/old-cached/deno', probe);

    expect(probe).toHaveBeenCalledTimes(1);
  });

  /* The answer cannot change under a running process, and the code tool asks once per
     execute call, so the probe must not become a spawn per request. */
  it('probes each executable only once', () => {
    const probe = jest.fn().mockReturnValue({ status: 0 });

    denoAcceptsUnixAllowNet('/cached/deno', probe);
    denoAcceptsUnixAllowNet('/cached/deno', probe);

    expect(probe).toHaveBeenCalledTimes(1);
  });
});
