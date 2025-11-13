const express = require("express");
const multer = require("multer");
const xlsx = require("xlsx");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(express.json()); // for fetch() JSON
const iv = Buffer.alloc(16);

// ======================
// 🔹 Method 1: Default salt-based
// ======================
const salt = "86e8a5f51e12023bd2d9867a55fa61d1";

// ======================
// 🔹 Method 2: Suriname password-based
// ======================
const password = "T3(#.5u1p0rt.r0C";
const surinameKey = crypto
  .createHash("md5")
  .update(password, "utf-8")
  .digest("hex")
  .toUpperCase();

// ======================
// 🔹 Utility functions
// ======================
function encrypt(text, key) {
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return encrypted;
}

function decrypt(text, key) {
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  let dec = decipher.update(text, "hex", "utf8");
  dec += decipher.final("utf8");
  return dec;
}

// ======================
// 🔹 Serve HTML UI
// ======================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ======================
// 🔹 Excel Decrypt Route
// ======================
app.post("/decrypt", upload.single("excel"), (req, res) => {
  const filePath = req.file.path;
  const fields = req.body.fields.split(",").map((f) => f.trim());
  const method = req.body.method || "default"; // "default" or "suriname"

  const key = method === "suriname" ? surinameKey : salt;

  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet);

  data.forEach((row) => {
    fields.forEach((field) => {
      if (row[field]) {
        try {
          row[field] = decrypt(row[field], key);
        } catch (err) {
          row[field] = null;
        }
      }
    });
  });

  const newSheet = xlsx.utils.json_to_sheet(data);
  const newWb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(newWb, newSheet, "Sheet1");

  const outFile = `output_${Date.now()}.xlsx`;
  xlsx.writeFile(newWb, outFile);

  res.download(outFile, () => {
    fs.unlinkSync(filePath);
    fs.unlinkSync(outFile);
  });
});

// ======================
// 🔹 String Encrypt API
// ======================
app.post("/encrypt-str", (req, res) => {
  const { text, method } = req.body;
  if (!text) return res.status(400).json({ error: "No text provided" });

  const key = method === "suriname" ? surinameKey : salt;

  try {
    let list = text.split("\n").map((f) => f.trim());
    let result = list.map((t) => encrypt(t, key)).join("<br>");
    res.json({ result });
  } catch (err) {
    res.status(500).json({ error: "Encryption failed", details: err.message });
  }
});

// ======================
// 🔹 String Decrypt API
// ======================
app.post("/decrypt-str", (req, res) => {
  const { text, method } = req.body;
  if (!text) return res.status(400).json({ error: "No text provided" });

  const key = method === "suriname" ? surinameKey : salt;

  try {
    let list = text.split("\n").map((f) => f.trim());
    let result = list.map((t) => decrypt(t, key)).join("<br>");
    res.json({ result });
  } catch (err) {
    res.status(500).json({ error: "Decryption failed", details: err.message });
  }
});

// ======================
process.on("uncaughtException", (err) => {
  console.error("💥 Uncaught Exception:", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("⚠️ Unhandled Rejection:", reason);
});

app.listen(3000, () =>
  console.log("✅ Server running at http://localhost:3000")
);
