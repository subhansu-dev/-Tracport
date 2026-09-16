import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Support JSON payloads with compressed photos
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // File persistence setup
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const dataFile = path.join(dataDir, "inspections.json");

  function readInspections(): any[] {
    try {
      if (!fs.existsSync(dataFile)) {
        return [];
      }
      const raw = fs.readFileSync(dataFile, "utf-8");
      return JSON.parse(raw);
    } catch (err) {
      console.error("Error reading inspections:", err);
      return [];
    }
  }

  function writeInspections(items: any[]) {
    try {
      fs.writeFileSync(dataFile, JSON.stringify(items, null, 2), "utf-8");
    } catch (err) {
      console.error("Error writing inspections:", err);
    }
  }

  // API Routes
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // AI Image Sharpening & Enhancement Route
  app.post("/api/enhance-image", async (req, res) => {
    try {
      const { image } = req.body;
      if (!image || typeof image !== "string") {
        return res.status(400).json({ success: false, error: "Image data is required" });
      }

      const ai = getAIClient();
      if (!ai) {
        return res.status(503).json({ success: false, error: "GEMINI_API_KEY is not configured" });
      }

      let base64Data = image;
      let mimeType = "image/jpeg";
      if (image.startsWith("data:")) {
        const match = image.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          mimeType = match[1];
          base64Data = match[2];
        }
      }

      // Call Gemini 3.1 Flash Lite Image model for image editing & sharpening
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-image",
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType,
              },
            },
            {
              text: "Perform high-quality AI photo enhancement and super-resolution sharpening on this image. Sharpen all blurry text, labels, edges, and object details with extreme clarity and crisp micro-contrast. Keep original colors and composition completely authentic.",
            },
          ],
        },
      });

      let enhancedBase64 = "";
      const parts = response.candidates?.[0]?.content?.parts;
      if (parts && parts.length > 0) {
        for (const part of parts) {
          if (part.inlineData?.data) {
            const outMime = part.inlineData.mimeType || "image/jpeg";
            enhancedBase64 = `data:${outMime};base64,${part.inlineData.data}`;
            break;
          }
        }
      }

      if (!enhancedBase64) {
        return res.status(500).json({ success: false, error: "AI did not produce enhanced image" });
      }

      return res.json({ success: true, image: enhancedBase64 });
    } catch (err: any) {
      console.warn("AI enhancement service note:", err.message);
      return res.status(500).json({ success: false, error: err.message || "AI enhancement error" });
    }
  });

  // Reverse Geocoding API route using OpenStreetMap Nominatim
  app.get("/api/reverse-geocode", async (req, res) => {
    try {
      const { lat, lon } = req.query;
      if (!lat || !lon) {
        return res.status(400).json({ success: false, error: "Latitude and longitude required" });
      }

      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(
        String(lat)
      )}&lon=${encodeURIComponent(String(lon))}&zoom=18&addressdetails=1`;

      const response = await fetch(url, {
        headers: {
          "User-Agent": "TracportApp/1.0 (inspection-app)",
          "Accept-Language": "en",
        },
      });

      if (!response.ok) {
        throw new Error(`Geocoding service returned status ${response.status}`);
      }

      const data = await response.json();
      const addr = data.address || {};

      // Compose human-readable specific area / place name (e.g. "GJU, Hisar", "Sector 15A, Hisar", etc.)
      const place =
        addr.university ||
        addr.college ||
        addr.school ||
        addr.hospital ||
        addr.amenity ||
        addr.building ||
        addr.commercial ||
        addr.industrial ||
        addr.suburb ||
        addr.neighbourhood ||
        addr.residential ||
        addr.road ||
        "";

      const city = addr.city || addr.town || addr.village || addr.county || addr.state_district || "";
      const state = addr.state || "";
      const postcode = addr.postcode || addr.postal_code || addr.zip || "";

      let cleanArea = "";
      if (place && city && place.toLowerCase() !== city.toLowerCase()) {
        cleanArea = `${place}, ${city}`;
      } else if (place) {
        cleanArea = place;
      } else if (city) {
        cleanArea = `${city}${state ? `, ${state}` : ""}`;
      } else {
        cleanArea = data.display_name?.split(",").slice(0, 3).join(",").trim() || "Area Detected";
      }

      res.json({
        success: true,
        areaName: cleanArea,
        postcode: postcode,
        displayName: data.display_name || cleanArea,
        address: addr,
      });
    } catch (err: any) {
      console.error("Reverse geocoding error:", err);
      res.status(500).json({ success: false, error: err.message || "Failed to geocode" });
    }
  });

  app.get("/api/inspections", (_req, res) => {
    const list = readInspections().map((item: any) => ({
      ...item,
      isSynced: true,
    }));
    res.json({ success: true, count: list.length, data: list });
  });

  app.post("/api/inspections", (req, res) => {
    try {
      const body = req.body;
      if (!body.location || !body.description) {
        return res.status(400).json({ success: false, error: "Location and description are required" });
      }

      const current = readInspections();
      const newInspection = {
        id: body.id || `insp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        location: body.location,
        gpsCoords: body.gpsCoords || null,
        peopleCount: body.peopleCount || "0",
        people: Array.isArray(body.people) ? body.people : [],
        images: Array.isArray(body.images) ? body.images : [],
        description: body.description,
        rating: typeof body.rating === "number" ? body.rating : 0,
        compartments: Array.isArray(body.compartments) ? body.compartments : [],
        extraDescriptions: Array.isArray(body.extraDescriptions) ? body.extraDescriptions : [],
        extraRatings: Array.isArray(body.extraRatings) ? body.extraRatings : [],
        createdAt: body.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isSynced: true,
      };

      const updated = [newInspection, ...current.filter((item) => item.id !== newInspection.id)];
      writeInspections(updated);

      res.status(201).json({ success: true, data: newInspection });
    } catch (error: any) {
      console.error("Failed to save inspection:", error);
      res.status(500).json({ success: false, error: error.message || "Failed to save inspection" });
    }
  });

  app.delete("/api/inspections/:id", (req, res) => {
    try {
      const { id } = req.params;
      const current = readInspections();
      const filtered = current.filter((item) => item.id !== id);
      writeInspections(filtered);
      res.json({ success: true, deletedId: id });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Tracport Server running on http://localhost:${PORT}`);
  });
}

startServer();
