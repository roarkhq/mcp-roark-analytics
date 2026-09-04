import { localDocsSearchFor } from '../src/server';

describe('localDocsSearchFor', () => {
  it('builds the index once per docsDir rather than per request', async () => {
    const [first, second] = await Promise.all([localDocsSearchFor(), localDocsSearchFor()]);

    expect(first).toBe(second);
    expect(await localDocsSearchFor()).toBe(first);
  });

  it('keeps a directory-backed index separate from the embedded one', async () => {
    expect(await localDocsSearchFor('./tests')).not.toBe(await localDocsSearchFor());
  });

  it('returns a usable index', async () => {
    const search = await localDocsSearchFor();
    const { results } = search.search({ query: 'customer flows', language: 'python', maxResults: 3 });

    expect(results.length).toBeGreaterThan(0);
  });
});

describe('localDocsSearchFor failure handling', () => {
  it('does not cache a failed build, so a later call can retry', async () => {
    const { LocalDocsSearch } = require('../src/local-docs-search');
    const create = jest.spyOn(LocalDocsSearch, 'create');

    create.mockRejectedValueOnce(new Error('index build failed'));
    await expect(localDocsSearchFor('./src')).rejects.toThrow('index build failed');

    create.mockRestore();
    await expect(localDocsSearchFor('./src')).resolves.toBeDefined();
  });
});
