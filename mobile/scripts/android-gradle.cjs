const path = require("node:path");
const { spawnSync } = require("node:child_process");
const windows = process.platform === "win32";
const tasks = process.argv.slice(2);
const result = spawnSync(
  windows ? "cmd.exe" : "./gradlew",
  windows ? ["/d", "/s", "/c", "gradlew.bat", ...tasks] : tasks,
  { cwd: path.join(__dirname, "..", "android"), stdio: "inherit", windowsHide: true },
);
if (result.error) console.error("Préparez Android avec npm run prebuild:android avant de lancer Gradle.");
process.exit(result.status ?? 1);
