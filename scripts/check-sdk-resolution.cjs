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
const { createRequire } = require('node:module');
const path = require('node:path');

const main = () => {
  const probe = process.argv[2];
  if (!probe) {
    throw new Error('usage: check-sdk-resolution.cjs <directory where the tarball is installed>');
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
  const fromServer = createRequire(methodsPath);
  const sdk = fromServer('@roarkanalytics/sdk');
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
    throw new Error(
      `${missing.length} of ${sdkMethods.length} tools do not resolve on the SDK this build ships against ` +
        '(listed above). The method table names resources the pinned @roarkanalytics/sdk does not have. ' +
        'Either the SDK release carrying them is not out yet, or the dependency range in package.json was ' +
        'not moved with the regenerated table.',
    );
  }

  console.log(`all ${sdkMethods.length} tools resolve on the SDK this build ships against`);
};

try {
  main();
} catch (error) {
  console.error(`::error::${error.message}`);
  process.exit(1);
}
