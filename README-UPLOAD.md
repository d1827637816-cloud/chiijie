Server upload (optional)
========================

This project includes an optional Node.js upload server to allow saving product images to the project when adding products from the admin UI.

How it works
- The Express server listens on `/api/upload` and saves files to `public/uploads`.
- The admin UI calls `/api/upload` when a file is selected and uses the returned URL as product `img`.

Run locally

1. Install dependencies:

```bash
npm install
```

2. Start server:

```bash
npm start
```

3. Open the site at `http://localhost:3000/admin.html` (serve the folder with a static server or open in browser pointing to that file — for full backend features, serve via a static server and ensure the upload server runs on same origin or enable CORS).

Notes
- GitHub Pages (or other static hosts) cannot accept file uploads. Run the Node server locally to use the upload feature.
- Uploaded files are saved under `public/uploads` and served from `/uploads/<filename>`.
