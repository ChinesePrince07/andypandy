import express from "express";
import path from "path";
import fs from "fs";

export function firmware() {
  const router = express.Router();

  const firmwareDir = path.join(process.cwd(), "firmware");

  // Create firmware directory if it doesn't exist
  if (!fs.existsSync(firmwareDir)) {
    fs.mkdirSync(firmwareDir, { recursive: true });
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
