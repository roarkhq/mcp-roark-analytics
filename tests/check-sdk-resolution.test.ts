// `scripts/check-sdk-resolution.cjs` is the last thing standing between a
// regenerated method table and a published server whose tools return undefined,
// and until now the only thing exercising it was CI doing real `npm install`s.
// That covers the happy path on one machine at one moment and gives no way to
// ask what happens when a method is missing - the case the script exists for -
// without publishing a broken SDK to find out.
//
// So: fixture packages on disk, no registry. The script is run as a child
// process rather than imported, because its contract IS the process contract -
// `::error::` on stderr, the missing entries listed one per line above it, and a
// non-zero exit. Importing it would test a function nothing calls.
import { execFileSync, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const SCRIPT = path.join(__dirname, '..', 'scripts', 'check-sdk-resolution.cjs');

/** Every method the fake table names. The fixtures vary which of these exist. */
const TABLE = ['agent.create', 'agent.build', 'agentConfig.list'] as const;

let root: string;

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdk-resolution-'));
});

afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

const write = (file: string, contents: string) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
};

/**
 * A directory that resolves `@roarkanalytics/sdk` to a client exposing exactly
 * `methods`. No `exports` map, so subpath resolution stays on the legacy file
 * path rules and the fixture does not have to restate npm's.
 */
const makeSdk = (dir: string, version: string, methods: readonly string[]) => {
  const base = path.join(dir, 'node_modules', '@roarkanalytics', 'sdk');
  write(
    path.join(base, 'package.json'),
    JSON.stringify({ name: '@roarkanalytics/sdk', version, main: 'index.js' }),
  );

  // Built in the constructor rather than on the prototype: the script reads
  // `client[resource][method]` off an instance, because in the real SDK the
  // resource accessors are instance getters.
  const resources: Record<string, string[]> = {};
  for (const method of methods) {
    const [resource, name] = method.split('.') as [string, string];
    (resources[resource] ??= []).push(name);
  }
  const assignments = Object.entries(resources)
    .map(
      ([resource, names]) => `    this.${resource} = { ${names.map((n) => `${n}: () => {}`).join(', ')} };`,
    )
    .join('\n');

  write(
    path.join(base, 'index.js'),
    `class Roark {\n  constructor(options) {\n    if (!options || !options.bearerToken) throw new Error('missing credentials');\n${assignments}\n  }\n}\nmodule.exports = Roark;\n`,
  );
};

/**
 * A probe directory as the workflows build one: the packed server installed with
 * an SDK beside it. `sdkMethods` mirrors the shape `src/methods.ts` generates -
 * `fullyQualifiedName` is what the script reads, `clientCallName` is what it
 * prints.
 */
const makeProbe = (name: string, sdkVersion: string, sdkMethods: readonly string[]) => {
  const dir = path.join(root, name);
  const server = path.join(dir, 'node_modules', '@roarkanalytics', 'sdk-mcp');
  write(
    path.join(server, 'package.json'),
    JSON.stringify({ name: '@roarkanalytics/sdk-mcp', version: '0.0.0-fixture', main: 'index.js' }),
  );
  write(path.join(server, 'index.js'), 'module.exports = {};\n');
  write(
    path.join(server, 'methods.js'),
    `exports.sdkMethods = ${JSON.stringify(
      TABLE.map((name) => ({ fullyQualifiedName: name, clientCallName: `client.${name}` })),
    )};\n`,
  );
  makeSdk(dir, sdkVersion, sdkMethods);
  return dir;
};

/** A bare directory holding only an SDK, as the floor check installs one. */
const makeSdkOnly = (name: string, version: string, methods: readonly string[]) => {
  const dir = path.join(root, name);
  fs.mkdirSync(dir, { recursive: true });
  makeSdk(dir, version, methods);
  return dir;
};

const run = (...args: string[]) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });

describe('with no second argument, it judges the SDK the probe resolved', () => {
  test('passes when every method in the table is present', () => {
    const probe = makeProbe('complete', '4.2.0', TABLE);

    const output = execFileSync(process.execPath, [SCRIPT, probe], { encoding: 'utf8' });

    expect(output).toContain('all 3 tools resolve');
    // The version is named so a green log still says what it was green against.
    expect(output).toContain('4.2.0');
  });

  test('fails, lists each missing tool, and blames the pinned SDK', () => {
    const probe = makeProbe('pinned-too-old', '4.0.0', ['agent.create']);

    const { status, stderr } = run(probe);

    expect(status).toBe(1);
    expect(stderr).toContain('client.agent.build');
    expect(stderr).toContain('client.agentConfig.list');
    expect(stderr).toContain('2 of 3 tools do not resolve on the SDK this build ships against');
    expect(stderr).toContain('4.0.0');
    // The floor wording belongs to the other caller and would be wrong here.
    expect(stderr).not.toContain('the oldest version the range');
  });

  test('a resource missing entirely is treated the same as a missing method', () => {
    // `agentConfig` does not exist at all, rather than existing without `list`.
    const probe = makeProbe('resource-absent', '4.0.0', ['agent.create', 'agent.build']);

    const { status, stderr } = run(probe);

    expect(status).toBe(1);
    expect(stderr).toContain('client.agentConfig.list');
    expect(stderr).toContain('1 of 3 tools');
  });
});

describe('with a second argument, it judges the SDK in that directory', () => {
  test('passes when the floor carries the whole table', () => {
    const probe = makeProbe('floor-ok-probe', '4.2.0', TABLE);
    const floor = makeSdkOnly('floor-ok', '4.2.0', TABLE);

    const output = execFileSync(process.execPath, [SCRIPT, probe, floor], { encoding: 'utf8' });

    expect(output).toContain('all 3 tools resolve on @roarkanalytics/sdk@4.2.0, the oldest the range admits');
  });

  test('fails against the floor even when the probe resolved a newer SDK that would pass', () => {
    // The regression this argument exists for. The probe holds 4.2.0, which has
    // everything - that is the answer `publish.yml` gets, and it is the answer
    // that let sdk-mcp 4.2.0 publish green while declaring `^4.0.0`. Reading the
    // floor instead has to override it, or the split does nothing.
    const probe = makeProbe('newer-probe', '4.2.0', TABLE);
    const floor = makeSdkOnly('older-floor', '4.0.0', ['agent.create']);

    expect(execFileSync(process.execPath, [SCRIPT, probe], { encoding: 'utf8' })).toContain(
      'all 3 tools resolve',
    );

    const { status, stderr } = run(probe, floor);

    expect(status).toBe(1);
    expect(stderr).toContain('2 of 3 tools do not resolve on @roarkanalytics/sdk@4.0.0');
    expect(stderr).toContain('the oldest version the range in package.json admits');
    // The remedy has to name raising the floor; "the pinned SDK" would send the
    // reader to the shrinkwrap this package does not have.
    expect(stderr).toContain('Raise the floor');
  });

  test('the table still comes from the probe, not from the floor directory', () => {
    // The floor directory holds no server at all. If the script read the table
    // from there it would fail to resolve rather than report tools, so a clean
    // pass proves the two resolutions stay separate.
    const probe = makeProbe('table-source-probe', '4.2.0', TABLE);
    const floor = makeSdkOnly('table-source-floor', '4.2.0', TABLE);

    expect(fs.existsSync(path.join(floor, 'node_modules', '@roarkanalytics', 'sdk-mcp'))).toBe(false);
    expect(execFileSync(process.execPath, [SCRIPT, probe, floor], { encoding: 'utf8' })).toContain(
      'all 3 tools',
    );
  });
});

describe('argument handling', () => {
  test('refuses to run with no probe directory, and says what it wanted', () => {
    const { status, stderr } = run();

    expect(status).toBe(1);
    expect(stderr).toContain('::error::');
    expect(stderr).toContain('usage: check-sdk-resolution.cjs');
  });

  test('a probe with no installed server fails loudly rather than reporting zero tools', () => {
    const empty = path.join(root, 'empty');
    fs.mkdirSync(empty, { recursive: true });

    const { status, stderr } = run(empty);

    expect(status).toBe(1);
    expect(stderr).toContain('::error::');
    // Whatever the message, it must not be a green "all 0 tools resolve".
    expect(stderr).not.toContain('all 0 tools resolve');
  });
});
