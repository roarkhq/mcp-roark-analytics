// Keep the version the MCP server reports in step with this package's
// `package.json`.
//
// `src/client-headers.ts` declares it as a literal, marked `x-release-please-version`,
// because release-please rewrote it in the repository this package used to live
// in. There is no release-please here: this package is not on the SDK's release
// train, its version is its own, and a human bumps `package.json` before
// dispatching `publish.yml`. So the one thing that rewrote that literal is gone,
// and without this the server would keep announcing 3.2.0 to every client it
// handshakes with, forever, while npm served something else.
//
// That is not hypothetical. `@roarkanalytics/cli@0.1.0` published reporting
// `2.31.0` for exactly this reason, one repository over, and npm versions are
// immutable.
//
// The server reports it in the MCP handshake and sends it to the API in
// `X-Roark-Client`, both read from that one literal.
//
// Runs before tsc, so the compiled output can only ever carry the version that
// is about to be published.
const fs = require('fs');
const path = require('path');

const main = () => {
  const version = require('../package.json').version;
  if (typeof version !== 'string' || !version) {
    throw new Error(`package.json has no usable version; got ${typeof version}`);
  }
  // Compiled in and sent in the MCP handshake, so a typo reaches the registry as
  // the package's identity. `v3.3.0` and `3.3` both install fine and both read
  // as wrong forever.
  if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`package.json version is not semver: ${version}`);
  }

  const versionFile = path.resolve(__dirname, '..', 'src', 'client-headers.ts');
  const contents = fs.readFileSync(versionFile, 'utf8');
  // Anchored on the marker, so nothing else that mentions a version is rewritten.
  const PATTERN = /(MCP_SERVER_VERSION = ')([^']*)('; \/\/ x-release-please-version)/;
  if (!PATTERN.test(contents)) {
    throw new Error(
      'src/client-headers.ts has no x-release-please-version marker; nothing to sync. If the line ' +
        'was reworded, reword this pattern with it rather than deleting the sync.',
    );
  }

  const updated = contents.replace(PATTERN, `$1${version}$3`);
  if (updated !== contents) {
    fs.writeFileSync(versionFile, updated);
    console.log(`synced src/client-headers.ts to ${version}`);
  }
};

if (require.main === module) {
  main();
}
