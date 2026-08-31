// Vendored from sdk-roark-analytics-node's scripts/utils/make-dist-package-json.cjs.
// The only change is the default path: there this file sat in `scripts/utils/`
// and the manifest it read was two levels up; here it is one, and the build no
// longer passes PKG_JSON_PATH because there is only one package.json to mean.
const pkgJson = require(process.env['PKG_JSON_PATH'] || '../package.json');

function processExportMap(m) {
  for (const key in m) {
    const value = m[key];
    if (typeof value === 'string') m[key] = value.replace(/^\.\/dist\//, './');
    else processExportMap(value);
  }
}
processExportMap(pkgJson.exports);

for (const key of ['types', 'main', 'module']) {
  if (typeof pkgJson[key] === 'string') pkgJson[key] = pkgJson[key].replace(/^(\.\/)?dist\//, './');
}
// Fix bin paths if present
if (pkgJson.bin) {
  for (const key in pkgJson.bin) {
    if (typeof pkgJson.bin[key] === 'string') {
      pkgJson.bin[key] = pkgJson.bin[key].replace(/^(\.\/)?dist\//, './');
    }
  }
}

delete pkgJson.devDependencies;
delete pkgJson.scripts.prepack;
delete pkgJson.scripts.prepublishOnly;
delete pkgJson.scripts.prepare;

console.log(JSON.stringify(pkgJson, null, 2));
