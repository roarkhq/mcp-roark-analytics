// Assert that every tool in the method table resolves on the SDK that will be
// installed alongside it.
//
// `src/methods.ts` is generated from the OpenAPI spec and addresses the SDK by
// string: `clientCallName` is `'client.autoimproveJob.create'`, a `string`, not
// a reference tsc can follow. That is what makes the table generatable, and it
// is also why the build cannot check it - nothing compares a name in the table
// against the package that has to provide it.
//
// v4.0.0 is what that costs. The SDK renamed `autoimproveFix` to
// `autoimproveJob` in its own 4.0.0, the table was regenerated to match, and
// the dependency range stayed at `^3.2.0` - which cannot resolve to a 4.x.
// Typecheck passed, 51 tests passed, the publish checks passed, and the
// published server pulls sdk 3.21.0, where all eight `autoimproveJob` tools
// resolve to `undefined` at call time. npm publishes are immutable.
//
// The two packages are versioned independently, so the matching `4.0.0` on both
// sides is a coincidence and reads as reassurance. The range between them is
// what decides what gets installed, and this is the check that reads it.
//
// Probed against an INSTALL of the packed tarball rather than against this
// repository's `node_modules`: the repo resolves from `pnpm-lock.yaml`, a user
// resolves from the published range, and it is the published one whose answer
// matters.
//
// The optional second argument is what makes that question answerable BEFORE a
// release is cut, and it is the one this package most needs answered. With no
// argument the SDK is resolved the way the server would resolve it - whichever
// version npm picked when the runner installed, which for a caret range is the
// NEWEST one published at that instant. That is a race against the SDK's own
// release, and winning it proves nothing about anyone else's install: this
// package ships no shrinkwrap, so a consumer re-resolves the range on their own
// machine and may land anywhere in it.
//
// 4.2.0 is what that costs. It went to npm declaring `^4.0.0` while the table
// named `agent.build` (SDK 4.2.0) and six `agentConfig.*` methods (SDK 4.1.0).
// The publish passed because it happened two hours after the SDK's, so the
// runner resolved 4.2.0. Install it next to an SDK 4.0.0 that the same range
// admits - an older lockfile, a pinned SDK elsewhere in the tree - and seven of
// a hundred tools are `undefined` at call time. The CLI hit the same bug the
// same day and was caught by its shrinkwrap; there is nothing here to catch it.
//
// Pointed at a directory holding one specific SDK, this asks the strict version
// instead: does the table resolve on the OLDEST version the range admits? There
// is no race in that. It is decided by two files in this repository, it is false
// the moment the generator outruns the range, and `ci.yml` asks it on the
// regeneration PR itself.
const { createRequire } = require('node:module');
const fs = require('node:fs');
const path = require('node:path');

// The SDK's `exports` map does not list `./package.json`, so requiring it throws
// ERR_PACKAGE_PATH_NOT_EXPORTED. Resolve the entry point and walk up to the
// manifest beside it instead. Only used to name a version in the message, so a
// miss degrades to "unknown" rather than failing the check.
const versionOfResolvedSdk = (resolver) => {
  try {
    let directory = path.dirname(resolver.resolve('@roarkanalytics/sdk'));
    for (;;) {
      const manifest = path.join(directory, 'package.json');
      if (fs.existsSync(manifest)) {
        return JSON.parse(fs.readFileSync(manifest, 'utf8')).version ?? 'unknown';
      }
      const parent = path.dirname(directory);
      if (parent === directory) return 'unknown';
      directory = parent;
    }
  } catch {
    return 'unknown';
  }
};

const main = () => {
  const probe = process.argv[2];
  const sdkDir = process.argv[3];
  if (!probe) {
    throw new Error(
      'usage: check-sdk-resolution.cjs <directory where the tarball is installed> [directory to resolve the SDK from]',
    );
  }

  // Resolve from inside the probe directory, so this reads the installed tree
  // rather than this repository's.
  const fromProbe = createRequire(path.join(probe, 'index.js'));
  const methodsPath = fromProbe.resolve('@roarkanalytics/sdk-mcp/methods');
  const { sdkMethods } = fromProbe('@roarkanalytics/sdk-mcp/methods');

  if (!Array.isArray(sdkMethods) || sdkMethods.length === 0) {
    throw new Error(`the installed methods module exported no sdkMethods array; got ${typeof sdkMethods}`);
  }

  // Resolve the SDK from the server's own location, not from this script's. npm
  // may hoist it or nest it under the server, and the server reads whichever is
  // nested-or-hoisted relative to itself.
  //
  // Unless a directory was named, in which case resolve from there: the caller
  // has installed one specific SDK and wants the table judged against THAT
  // rather than against whatever the probe install resolved. Kept in its own
  // directory rather than installed beside the tarball, because a copy nested
  // under the server would win over a hoisted one and the check would quietly
  // answer for the wrong version.
  const fromServer = createRequire(sdkDir ? path.join(sdkDir, 'index.js') : methodsPath);
  const sdk = fromServer('@roarkanalytics/sdk');
  const sdkVersion = versionOfResolvedSdk(fromServer);
  const Roark = sdk.default ?? sdk.Roark ?? sdk;
  // The constructor refuses to build without credentials and resource
  // accessors live on the instance, so there has to be one. Nothing here
  // performs a request; the base URL is a closed port so that a bug in that
  // direction fails loudly rather than reaching the real API.
  const client = new Roark({ bearerToken: 'resolution-probe', baseURL: 'http://127.0.0.1:1' });

  const missing = sdkMethods.filter((method) => {
    // `fullyQualifiedName` rather than parsing `clientCallName`: the former is
    // already `resource.method` with no `client.` prefix to strip, so there is
    // one less string convention to get wrong.
    const [resourceName, methodName] = method.fullyQualifiedName.split('.');
    const resource = client[resourceName];
    return resource == null || typeof resource[methodName] !== 'function';
  });

  if (missing.length > 0) {
    // Detail as plain log lines, summary as the annotation: a workflow
    // annotation is single-line and truncates at the first newline, which would
    // drop the list in the one case someone needs to read it.
    for (const method of missing) {
      console.error(`  ${method.clientCallName}`);
    }
    // Two callers with two different things to do about it, so the remedy is
    // worded per caller rather than left as one sentence that is half wrong
    // whichever way it is read.
    throw new Error(
      sdkDir ?
        `${missing.length} of ${sdkMethods.length} tools do not resolve on @roarkanalytics/sdk@${sdkVersion}, ` +
          'the oldest version the range in package.json admits (listed above). This package ships no ' +
          'shrinkwrap, so that range is the only thing standing between a consumer and a tool that returns ' +
          'undefined. Raise the floor to the SDK release carrying these methods - the regeneration that added ' +
          'them to the table is what should have moved it. If that release is not on npm yet this stays red ' +
          'until it is, which is correct: the tools cannot work before it exists.'
      : `${missing.length} of ${sdkMethods.length} tools do not resolve on the SDK this build ships against ` +
          `(@roarkanalytics/sdk@${sdkVersion}, listed above). The method table names resources the pinned ` +
          '@roarkanalytics/sdk does not have. Either the SDK release carrying them is not out yet, or the ' +
          'dependency range in package.json was not moved with the regenerated table.',
    );
  }

  console.log(
    sdkDir ?
      `all ${sdkMethods.length} tools resolve on @roarkanalytics/sdk@${sdkVersion}, the oldest the range admits`
    : `all ${sdkMethods.length} tools resolve on the SDK this build ships against (@roarkanalytics/sdk@${sdkVersion})`,
  );
};

try {
  main();
} catch (error) {
  console.error(`::error::${error.message}`);
  process.exit(1);
}
