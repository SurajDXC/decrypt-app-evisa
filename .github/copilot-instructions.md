# Copilot Instructions for Decryption App

## Project Overview
A Node.js/Express web app for encrypting and decrypting sensitive data (Excel files and strings) using AES-256-CBC cipher. Built for the Evisa Support team with two encryption methods: default (salt-based) and Suriname (MD5 hash-based).

## Architecture
- **Frontend**: Single `index.html` with Tailwind CSS UI (two-column layout: Excel tool + String tool)
- **Backend**: Express server (`server.js`) with three core endpoints
- **Encryption**: AES-256-CBC with 16-byte zero IV (`Buffer.alloc(16)`)
- **Excel Processing**: Multer handles file uploads → XLSX lib reads/writes → decrypted fields returned

## Key Design Patterns

### Encryption Methods
Two hardcoded keys support different regions:
1. **default**: Uses hex string salt `"86e8a5f51e12023bd2d9867a55fa61d1"` directly
2. **suriname**: Derives key via MD5 hash of password `"T3(#.5u1p0rt.r0C"` → uppercase hex

Choose method via UI dropdown; passed as `method` parameter in requests.

### Crypto Operations
- `encrypt()` and `decrypt()` functions in server.js are identical for both methods (only key differs)
- Fixed 16-byte zero IV limits security—key reuse across sessions is expected behavior
- Errors caught silently (failed decryption sets field to `null`)

### Data Flow - Excel Decrypt
1. File uploaded via form → stored in `uploads/` by Multer
2. Server reads XLSX, parses sheet to JSON
3. For each specified field, decrypt values using selected method
4. Generate new XLSX with decrypted data
5. Client downloads → server deletes temp files (source + output)

### Data Flow - String Operations
1. POST `/encrypt-str` or `/decrypt-str` with newline-separated text
2. Split by newline, process each line independently
3. Return joined results with `<br>` HTML formatting
4. Frontend renders as HTML (XSS risk if untrusted input)

## Development Workflow
```bash
npm install         # Install Express, Multer, XLSX, Crypto
npm start          # Runs server.js on port 3000
# Visit http://localhost:3000
```

## Critical File Locations
- [server.js](server.js): All backend logic (encrypt/decrypt functions, routes)
- [index.html](index.html): Frontend UI + client-side fetch calls to `/encrypt-str`, `/decrypt-str`, `/decrypt`
- [package.json](package.json): Dependencies (express, multer, xlsx, crypto)
- `uploads/`: Temporary storage for uploaded Excel files (auto-cleaned after processing)

## Important Constraints & Gotchas
- **No input validation**: Assumes valid Excel structure; missing fields are silently skipped
- **Zero IV**: Security implication—cipher output is deterministic (same plaintext = same ciphertext)
- **File cleanup**: Temp files deleted after download; if client never downloads, files orphan in `uploads/`
- **Single sheet**: Only processes `workbook.SheetNames[0]` (ignores other sheets)
- **Error handling**: Decrypt errors caught globally but don't stop processing other fields/rows
- **No authentication**: Public app—assumes it runs in trusted environment

## When Modifying This Codebase
- **Adding fields**: Update form defaults in `index.html` (line ~30: `value="applicantName, passportNumber"`)
- **Adding encryption methods**: Add new key constant + condition in both `/decrypt`, `/encrypt-str`, `/decrypt-str`
- **Changing crypto algorithm**: Update both `createCipheriv()` and `createDecipheriv()` calls to maintain parity
- **File uploads**: Increase multer destination or add cleanup interval if uploads/ grows
- **Production deployment**: Consider HTTPS, validate file types (currently accepts any file), store keys in environment variables instead of hardcoding
