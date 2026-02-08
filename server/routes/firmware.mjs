import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function firmware() {
  const router = express.Router();

  // firmware/ is in the server directory (parent of routes/)
  const firmwareDir = path.join(__dirname, '..', 'firmware');

  console.log("Firmware directory:", firmwareDir);

  // Create firmware directory if it doesn't exist
  if (!fs.existsSync(firmwareDir)) {
    console.log("Creating firmware directory");
    fs.mkdirSync(firmwareDir, { recursive: true });
  } else {
    console.log("Firmware directory exists, contents:", fs.readdirSync(firmwareDir));
  }

  // Get current firmware version
  router.get("/version", (req, res) => {
    const versionFile = path.join(firmwareDir, "version.txt");

    if (!fs.existsSync(versionFile)) {
      // Default version if no firmware uploaded yet
      res.send("1.0.0");
      return;
    }

    const version = fs.readFileSync(versionFile, "utf-8").trim();
    console.log("Firmware version requested:", version);
    res.send(version);
  });

  // Download firmware binary
  router.get("/download", (req, res) => {
    const firmwarePath = path.join(firmwareDir, "firmware.bin");

    if (!fs.existsSync(firmwarePath)) {
      res.status(404).send("No firmware available");
      return;
    }

    console.log("Firmware download requested");
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", "attachment; filename=firmware.bin");
    res.sendFile(firmwarePath);
  });

  // Upload new firmware (protected endpoint)
  router.post("/upload", express.raw({ type: "application/octet-stream", limit: "4mb" }), (req, res) => {
    const version = req.query.version;

    if (!version) {
      res.status(400).send("version required");
      return;
    }

    const firmwarePath = path.join(firmwareDir, "firmware.bin");
    const versionFile = path.join(firmwareDir, "version.txt");

    fs.writeFileSync(firmwarePath, req.body);
    fs.writeFileSync(versionFile, version);

    console.log("Firmware uploaded:", version, req.body.length, "bytes");
    res.send("OK");
  });

  return router;
}
