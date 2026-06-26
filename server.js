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
// 🔹 Date parsing and formatting
// ======================
function parseDate(val) {
  if (!val && val !== 0) return null;

  // Handle Date objects returned by xlsx for proper date cells
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    const y = val.getUTCFullYear();
    const m = String(val.getUTCMonth() + 1).padStart(2, '0');
    const d = String(val.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const str = String(val).trim();

  // Already YYYY-MM-DD — return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  // M/D/YYYY or MM/DD/YYYY  →  month / day / year  (e.g. 1/21/1977, 3/15/1985)
  // Logic: slash-separated → first part is MONTH, second is DAY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
    const [mo, da, yr] = str.split('/');
    return `${yr}-${mo.padStart(2, '0')}-${da.padStart(2, '0')}`;
  }

  // DD-MM-YYYY  →  day - month - year  (e.g. 01-12-2020, 07-07-2021)
  // Logic: dash-separated → first part is DAY, second is MONTH
  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(str)) {
    const [da, mo, yr] = str.split('-');
    const day = parseInt(da, 10);
    const month = parseInt(mo, 10);
    // Sanity check: if month part exceeds 12 it must actually be the day → swap
    if (month > 12) {
      return `${yr}-${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}`;
    }
    return `${yr}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  // YYYY/MM/DD
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(str)) {
    return str.replace(/\//g, '-');
  }

  // Return original if no format matched
  return str;
}

// Array of date column names to automatically format
const dateColumns = ["Dob", "App Date", "DOB", "AppDate", "app_date", "dob"];

// ======================
// 🔹 Serve HTML UI
// ======================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/splitter.html", (req, res) => {
  res.sendFile(path.join(__dirname, "splitter.html"));
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
    
    // Format date columns
    Object.keys(row).forEach((col) => {
      if (dateColumns.includes(col)) {
        row[col] = parseDate(row[col]);
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
// 🔹 Excel Encrypt Route
// ======================
app.post("/encrypt", upload.single("excel"), (req, res) => {
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
          row[field] = encrypt(String(row[field]), key);
        } catch (err) {
          row[field] = null;
        }
      }
    });
    
    // Format date columns
    Object.keys(row).forEach((col) => {
      if (dateColumns.includes(col)) {
        row[col] = parseDate(row[col]);
      }
    });
  });

  const newSheet = xlsx.utils.json_to_sheet(data);
  const newWb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(newWb, newSheet, "Sheet1");

  const outFile = `output_encrypted_${Date.now()}.xlsx`;
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

app.listen(3001, () =>
  console.log("✅ Server running at http://localhost:3001")
);
