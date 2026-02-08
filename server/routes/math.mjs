import express from "express";

export function math() {
  const router = express.Router();

  const NEWTON_API = "https://newton.vercel.app/api/v2";

  // Derivative endpoint
  router.get("/derive", async (req, res) => {
    const expr = req.query.expr;
    if (!expr) {
      res.status(400).send("missing expr");
      return;
    }

    try {
      console.log("derive:", expr);
      const encoded = encodeURIComponent(expr);
      const response = await fetch(`${NEWTON_API}/derive/${encoded}`);
      const data = await response.json();

      if (data.error) {
        console.log("newton error:", data.error);
        res.send("ERROR: " + data.error);
        return;
      }

      // Format result for calculator display
      const result = `d/dx(${expr}) = ${data.result}`;
      console.log("result:", result);
      res.send(result.toUpperCase());
    } catch (err) {
      console.error("derive error:", err);
      res.send("ERROR: FAILED");
    }
  });

  // Integral endpoint
  router.get("/integrate", async (req, res) => {
    const expr = req.query.expr;
    if (!expr) {
      res.status(400).send("missing expr");
      return;
    }

    try {
      console.log("integrate:", expr);
      const encoded = encodeURIComponent(expr);
      const response = await fetch(`${NEWTON_API}/integrate/${encoded}`);
      const data = await response.json();

      if (data.error) {
        console.log("newton error:", data.error);
        res.send("ERROR: " + data.error);
        return;
      }

      // Format result for calculator display (add +C for indefinite integral)
      const result = `integral(${expr}) = ${data.result} + C`;
      console.log("result:", result);
      res.send(result.toUpperCase());
    } catch (err) {
      console.error("integrate error:", err);
      res.send("ERROR: FAILED");
    }
  });

  // Simplify endpoint (bonus)
  router.get("/simplify", async (req, res) => {
    const expr = req.query.expr;
    if (!expr) {
      res.status(400).send("missing expr");
      return;
    }

    try {
      console.log("simplify:", expr);
      const encoded = encodeURIComponent(expr);
      const response = await fetch(`${NEWTON_API}/simplify/${encoded}`);
      const data = await response.json();

      if (data.error) {
        res.send("ERROR: " + data.error);
        return;
      }

      res.send(data.result.toUpperCase());
    } catch (err) {
      console.error("simplify error:", err);
      res.send("ERROR: FAILED");
    }
  });

  return router;
}
