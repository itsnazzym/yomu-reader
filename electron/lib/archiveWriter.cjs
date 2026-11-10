const fs = require("node:fs");
const crypto = require("node:crypto");
const archiver = require("archiver");

function createZipArchive(options) {
  if (typeof archiver === "function") {
    return archiver("zip", options);
  }
  if (archiver && archiver.ZipArchive) {
    return new archiver.ZipArchive(options);
  }
  if (archiver && typeof archiver.create === "function") {
    return archiver.create("zip", options);
  }
  if (archiver && archiver.Archiver) {
    return new archiver.Archiver("zip", options);
  }
  throw new Error("Moteur de compression d'archive non disponible");
}

async function writeZipArchiveAtomic(outputPath, options, populateArchive) {
  const operationId = `${process.pid}-${crypto.randomBytes(6).toString("hex")}`;
  const partialPath = `${outputPath}.partial-${operationId}`;
  const backupPath = `${outputPath}.backup-${operationId}`;
  const output = fs.createWriteStream(partialPath, { flags: "wx" });
  const archive = createZipArchive(options);

  try {
    await new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        if (error) {
          try { archive.abort(); } catch {}
          output.destroy();
          reject(error);
        } else {
          resolve();
        }
      };

      output.once("close", () => finish());
      output.once("error", finish);
      archive.once("error", finish);
      archive.once("warning", finish);
      archive.pipe(output);

      try {
        populateArchive(archive);
        Promise.resolve(archive.finalize()).catch(finish);
      } catch (error) {
        finish(error);
      }
    });

    const hadExistingOutput = fs.existsSync(outputPath);
    if (hadExistingOutput) {
      fs.renameSync(outputPath, backupPath);
    }
    try {
      fs.renameSync(partialPath, outputPath);
      if (hadExistingOutput) {
        fs.rmSync(backupPath, { force: true });
      }
    } catch (error) {
      if (hadExistingOutput && fs.existsSync(backupPath) && !fs.existsSync(outputPath)) {
        fs.renameSync(backupPath, outputPath);
      }
      throw error;
    }
  } catch (error) {
    try { fs.rmSync(partialPath, { force: true }); } catch {}
    try {
      if (fs.existsSync(backupPath) && !fs.existsSync(outputPath)) {
        fs.renameSync(backupPath, outputPath);
      }
    } catch {}
    throw error;
  }
}

module.exports = { createZipArchive, writeZipArchiveAtomic };
