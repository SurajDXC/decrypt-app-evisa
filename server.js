const express = require("express");
const multer = require("multer");
const xlsx = require("xlsx");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(express.json()); // For parsing JSON requests from fetch()

const iv = Buffer.alloc(16);
const salt = "86e8a5f51e12023bd2d9867a55fa61d1";

// 🔹 Encrypt function
function encrypt(text, key) {
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return encrypted;
}

// 🔹 Decrypt function
function decrypt(text, key) {
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  let dec = decipher.update(text, "hex", "utf8");
  dec += decipher.final("utf8");
  return dec;
}

// 🔹 Route for UI
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// 🔹 Route to handle Excel upload + decryption
app.post("/decrypt", upload.single("excel"), (req, res) => {
  const filePath = req.file.path;
  const fields = req.body.fields.split(",").map(f => f.trim());

  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet);

  data.forEach(row => {
    fields.forEach(field => {
      if (row[field]) {
        try {
          row[field] = decrypt(row[field], salt);
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

// 🔹 String Encrypt API (for frontend)
app.post("/encrypt-str", (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: "No text provided" });
  }

  try {
     let str = ``;
    let list = text.split("\n").map(f => f.trim())
    
    list.forEach(field => {
      str += encrypt(field, salt) + `<br>`;
    })
    res.json({ result: str });
  } catch (err) {
    res.status(500).json({ error: "Encryption failed", details: err.message });
  }
});

// 🔹 String Decrypt API (for frontend)
app.post("/decrypt-str", (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: "No text provided" });
  }

  try {
    let str = ``;
    let list = text.split("\n").map(f => f.trim())
    
    list.forEach(field => {
      str += decrypt(field, salt) + `<br>`;
    })
    // const decrypted = decrypt(text, salt);
    res.json({ result: str });
  } catch (err) {
    res.status(500).json({ error: "Decryption failed", details: err.message });
  }
});


process.on("uncaughtException", (err) => {
  console.error("💥 Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("⚠️ Unhandled Rejection:", reason);
});


app.listen(3000, () => console.log("✅ Server running at http://localhost:3000"));
