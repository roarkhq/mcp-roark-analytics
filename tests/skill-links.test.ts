import { readFileSync, readdirSync, statSync } from 'fs';
import { dirname, join, resolve } from 'path';

// The skills cross-reference each other and the concepts corpus by relative
// path. Nothing else checks those paths, and one of the trees they point into is
// not written here: `skills/roark-concepts/` is synced from
// roarkhq/app-roark-analytics, and the sync deletes every .md in that directory
// before rewriting it. So renaming or dropping a concept upstream silently
// orphans every link to it here, in a package with no build step to notice.
//
// This walks the tree and resolves every relative markdown reference, both the
// `[text](path.md)` links and the bare backticked `` `../x/y.md` `` paths the
// skills use in prose.

const SKILLS_DIR = resolve(__dirname, '..', 'plugins', 'roark', 'skills');

const markdownFilesIn = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return markdownFilesIn(full);
    return full.endsWith('.md') ? [full] : [];
  });

// A reference is either a markdown link target or a backticked path. Both are
// only interesting when relative and pointing at markdown: anything absolute or
// http is out of scope, and a bare filename in prose is too ambiguous to check.
const referencesIn = (body: string): string[] => {
  const linkTargets = [...body.matchAll(/\]\((\.[^)\s]+\.md)\)/g)].map((m) => m[1]!);
  const backticked = [...body.matchAll(/`(\.\.?\/[^`\s]+\.md)`/g)].map((m) => m[1]!);
  return [...new Set([...linkTargets, ...backticked])];
};

describe('skill cross-references', () => {
  const files = markdownFilesIn(SKILLS_DIR);

  it('finds the skills tree', () => {
    // Guards the guard: a moved directory would otherwise make every assertion
    // below pass by iterating nothing.
    expect(files.length).toBeGreaterThan(20);
  });

  it.each(files.map((file) => [file.slice(SKILLS_DIR.length + 1), file]))(
    '%s resolves every path it cites',
    (_name, file) => {
      const dir = dirname(file);

      for (const reference of referencesIn(readFileSync(file, 'utf8'))) {
        const target = resolve(dir, reference);
        // Named in the message because a bare "file not found" gives no clue
        // which of a dozen references in a long skill went stale.
        expect({ reference, exists: statSync(target, { throwIfNoEntry: false }) !== undefined }).toEqual({
          reference,
          exists: true,
        });
      }
    },
  );

  it('still points at the concepts corpus', () => {
    // The corpus is the reference this suite exists for; if every link to it
    // disappeared, the per-file checks above would go quietly green.
    const citations = files
      .flatMap((file) => referencesIn(readFileSync(file, 'utf8')))
      .filter((reference) => reference.includes('roark-concepts/'));

    expect(citations.length).toBeGreaterThan(10);
  });
});
