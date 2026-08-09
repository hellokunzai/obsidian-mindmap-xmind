import { readFileSync, writeFileSync } from "fs";

const targetVersion = process.env.npm_package_version;

const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const { minAppVersion } = manifest;
const currentVersion = manifest.version;

if (!targetVersion || currentVersion === targetVersion) {
  console.log("No version change.");
  process.exit(0);
}

const versions = JSON.parse(readFileSync("versions.json", "utf8"));
versions[targetVersion] = minAppVersion;
writeFileSync("versions.json", JSON.stringify(versions, null, "\t") + "\n");

manifest.version = targetVersion;
writeFileSync("manifest.json", JSON.stringify(manifest, null, "\t") + "\n");

console.log(`Bumped version to ${targetVersion}`);
