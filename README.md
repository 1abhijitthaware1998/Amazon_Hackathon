# QueryLab — Interactive SQL Playground

A browser-based SQL learning project with a seeded SQLite database. Explore the sample tables, run real SQL queries, and inspect results without setting up a server or database.

## Run locally

The SQL engine and fonts load from CDNs, so an internet connection is needed when opening the app.

1. Open a terminal in this folder.
2. Start a local web server:

   ```bash
   python -m http.server 8000
   ```

3. Open [http://localhost:8000](http://localhost:8000) in a browser.

You can also open `index.html` directly, but serving the files locally avoids browser restrictions on loading WebAssembly.

## Use the playground

- Edit the starter query or choose one from **Examples**.
- Select **Run query** or press **Ctrl+Enter** ( **⌘+Enter** on macOS).
- Select a table in the database explorer to load a preview query.
- Try `SELECT`, joins, aggregates, and data changes; each page load starts with a fresh in-memory database.

The sample database has `employees`, `departments`, and `sales` tables. Query results are rendered as text, and tables show at most 200 rows at a time.
