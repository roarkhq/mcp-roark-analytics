import { parseCLIOptions } from '../src/options';

// Mock process.argv
const mockArgv = (args: string[]) => {
  const originalArgv = process.argv;
  process.argv = ['node', 'test.js', ...args];
  return () => {
    process.argv = originalArgv;
  };
};

describe('parseCLIOptions', () => {
  it('default parsing should be stdio', () => {
    const cleanup = mockArgv([]);

    const result = parseCLIOptions();

    expect(result.transport).toBe('stdio');

    cleanup();
  });

  it('using http transport with a port', () => {
    const cleanup = mockArgv(['--transport=http', '--port=2222']);

    const result = parseCLIOptions();

    expect(result.transport).toBe('http');
    expect(result.port).toBe(2222);
    cleanup();
  });
});

describe('docs search mode', () => {
  it('defaults to the index shipped with this package', () => {
    const cleanup = mockArgv([]);

    expect(parseCLIOptions().docsSearchMode).toBe('local');

    cleanup();
  });

  it('still allows opting back into the Stainless-hosted search', () => {
    const cleanup = mockArgv(['--docs-search-mode=stainless-api']);

    expect(parseCLIOptions().docsSearchMode).toBe('stainless-api');

    cleanup();
  });
});
