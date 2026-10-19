const INITIAL_QUERY = `SELECT
  e.name,
  d.name AS department,
  e.salary
FROM employees e
JOIN departments d ON d.id = e.department_id
ORDER BY e.salary DESC;`;

const EXAMPLES = {
  employees: `SELECT name, role, salary
FROM employees
ORDER BY salary DESC
LIMIT 5;`,
  departments: `SELECT d.name AS department, COUNT(e.id) AS headcount
FROM departments d
LEFT JOIN employees e ON e.department_id = d.id
GROUP BY d.id
ORDER BY headcount DESC;`,
  sales: `SELECT strftime('%Y-%m', sale_date) AS month,
       ROUND(SUM(amount), 2) AS revenue
FROM sales
GROUP BY month
ORDER BY month;`,
  join: INITIAL_QUERY
};

const editor = document.getElementById("query-editor");
const lineNumbers = document.getElementById("line-numbers");
const runButton = document.getElementById("run-button");
const clearButton = document.getElementById("clear-button");
const exampleSelect = document.getElementById("example-select");
const resultsContent = document.getElementById("results-content");
const emptyState = document.getElementById("empty-state");
const resultCount = document.getElementById("result-count");
const resultsMeta = document.getElementById("results-meta");
const connectionDot = document.getElementById("connection-dot");
const connectionLabel = document.getElementById("connection-label");
const toast = document.getElementById("toast");

let database;
let toastTimeout;

function seedDatabase(SQL) {
  const db = new SQL.Database();
  db.run(`
    CREATE TABLE departments (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      location TEXT NOT NULL
    );
    CREATE TABLE employees (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      department_id INTEGER NOT NULL REFERENCES departments(id),
      salary INTEGER NOT NULL,
      hire_date TEXT NOT NULL
    );
    CREATE TABLE sales (
      id INTEGER PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      amount REAL NOT NULL,
      sale_date TEXT NOT NULL
    );

    INSERT INTO departments VALUES
      (1, 'Engineering', 'San Francisco'),
      (2, 'Design', 'New York'),
      (3, 'Marketing', 'Austin'),
      (4, 'Sales', 'Chicago');

    INSERT INTO employees VALUES
      (1, 'Avery Chen', 'Senior Engineer', 1, 145000, '2021-03-15'),
      (2, 'Morgan Patel', 'Product Designer', 2, 118000, '2022-07-11'),
      (3, 'Riley Brooks', 'Marketing Lead', 3, 126000, '2020-01-20'),
      (4, 'Jordan Kim', 'Account Executive', 4, 108000, '2023-02-06'),
      (5, 'Taylor Reed', 'Staff Engineer', 1, 162000, '2019-09-03'),
      (6, 'Casey Morgan', 'UX Designer', 2, 104000, '2022-11-14'),
      (7, 'Quinn Rivera', 'Sales Manager', 4, 139000, '2018-05-28'),
      (8, 'Drew Parker', 'Data Analyst', 3, 97000, '2023-06-19'),
      (9, 'Skyler James', 'Engineer', 1, 121000, '2024-01-08'),
      (10, 'Emerson Lane', 'Sales Representative', 4, 92000, '2024-04-22');

    INSERT INTO sales VALUES
      (1, 4, 12400.00, '2025-01-12'),
      (2, 7, 18750.00, '2025-01-23'),
      (3, 10, 9200.00, '2025-02-04'),
      (4, 4, 15600.00, '2025-02-18'),
      (5, 7, 22100.00, '2025-03-02'),
      (6, 10, 11350.00, '2025-03-14'),
      (7, 4, 19800.00, '2025-04-09'),
      (8, 7, 16400.00, '2025-04-26'),
      (9, 10, 13750.00, '2025-05-08'),
      (10, 4, 24500.00, '2025-05-19'),
      (11, 7, 20800.00, '2025-06-03'),
      (12, 10, 17200.00, '2025-06-21');
  `);
  return db;
}

function setConnection(state, message) {
  connectionDot.classList.toggle("connected", state === "connected");
  connectionDot.classList.toggle("failed", state === "failed");
  connectionLabel.textContent = message;
}

function updateLineNumbers() {
  const lineCount = editor.value.split("\n").length;
  lineNumbers.textContent = Array.from({ length: lineCount }, (_, index) => index + 1).join("\n");
  lineNumbers.scrollTop = editor.scrollTop;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => toast.classList.remove("visible"), 2400);
}

function showMessage(message, type, count, meta) {
  emptyState.hidden = true;
  resultsContent.hidden = false;
  resultsContent.replaceChildren();
  resultCount.textContent = count;
  resultsMeta.textContent = meta;

  const output = document.createElement("div");
  output.className = `result-message ${type}`;
  const icon = document.createElement("span");
  icon.className = "message-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = type === "error" ? "!" : "✓";
  const text = document.createElement("span");
  text.textContent = message;
  output.append(icon, text);
  resultsContent.append(output);
}

function renderResults(resultSets) {
  emptyState.hidden = true;
  resultsContent.hidden = false;
  resultsContent.replaceChildren();

  const nonEmptySets = resultSets.filter((result) => result.columns.length > 0);
  if (nonEmptySets.length === 0) {
    const changed = database.getRowsModified();
    const message = changed > 0
      ? `Query executed successfully. ${changed} row${changed === 1 ? "" : "s"} affected.`
      : "Query executed successfully. No rows returned.";
    showMessage(message, "success", `${changed} affected`, "Query completed");
    return;
  }

  const totalRows = nonEmptySets.reduce((sum, result) => sum + result.values.length, 0);
  const elapsed = (performance.now() - queryStartedAt).toFixed(0);
  resultCount.textContent = `${totalRows} row${totalRows === 1 ? "" : "s"}`;
  resultsMeta.textContent = `${nonEmptySets.length} result set${nonEmptySets.length === 1 ? "" : "s"} · ${elapsed} ms`;

  nonEmptySets.forEach((result, resultIndex) => {
    const section = document.createElement("div");
    section.className = "result-set";
    if (nonEmptySets.length > 1) {
      const label = document.createElement("div");
      label.className = "result-set-label";
      label.textContent = `Result ${resultIndex + 1}`;
      section.append(label);
    }

    const wrap = document.createElement("div");
    wrap.className = "result-table-wrap";
    const table = document.createElement("table");
    table.className = "result-table";
    const head = document.createElement("thead");
    const headingRow = document.createElement("tr");
    result.columns.forEach((column) => {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = column;
      headingRow.append(th);
    });
    head.append(headingRow);
    table.append(head);

    const body = document.createElement("tbody");
    const visibleRows = result.values.slice(0, 200);
    visibleRows.forEach((row) => {
      const tr = document.createElement("tr");
      row.forEach((value) => {
        const td = document.createElement("td");
        td.textContent = value === null ? "NULL" : String(value);
        if (value === null) td.className = "is-null";
        tr.append(td);
      });
      body.append(tr);
    });
    table.append(body);
    wrap.append(table);
    section.append(wrap);

    if (result.values.length > visibleRows.length) {
      const note = document.createElement("div");
      note.className = "result-note";
      note.textContent = `Showing the first 200 of ${result.values.length} rows.`;
      section.append(note);
    }
    resultsContent.append(section);
  });
}

let queryStartedAt = 0;

function runQuery() {
  if (!database) {
    showMessage("The SQLite engine is not ready. Check your connection and reload the page.", "error", "Error", "Database unavailable");
    return;
  }
  const query = editor.value.trim();
  if (!query) {
    showMessage("Enter a SQL query before running it.", "error", "Error", "No query to run");
    editor.focus();
    return;
  }

  runButton.disabled = true;
  queryStartedAt = performance.now();
  try {
    const resultSets = database.exec(query);
    renderResults(resultSets);
  } catch (error) {
    showMessage(error.message, "error", "Error", "Query failed");
  } finally {
    runButton.disabled = false;
  }
}

function previewTable(tableName) {
  if (!database) {
    showToast("Database is still loading.");
    return;
  }
  editor.value = `SELECT *\nFROM ${tableName}\nLIMIT 10;`;
  updateLineNumbers();
  runQuery();
  editor.focus();
}

editor.value = INITIAL_QUERY;
updateLineNumbers();

editor.addEventListener("input", updateLineNumbers);
editor.addEventListener("scroll", () => {
  lineNumbers.scrollTop = editor.scrollTop;
});
editor.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    runQuery();
  }
  if (event.key === "Tab") {
    event.preventDefault();
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    editor.setRangeText("  ", start, end, "end");
    updateLineNumbers();
  }
});
runButton.addEventListener("click", runQuery);
clearButton.addEventListener("click", () => {
  editor.value = "";
  updateLineNumbers();
  editor.focus();
});
exampleSelect.addEventListener("change", () => {
  if (!exampleSelect.value) return;
  editor.value = EXAMPLES[exampleSelect.value];
  updateLineNumbers();
  editor.focus();
  exampleSelect.value = "";
});
document.querySelectorAll(".table-item").forEach((item) => {
  item.addEventListener("click", () => previewTable(item.dataset.table));
});
document.getElementById("share-button").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(window.location.href);
    showToast("Page link copied to clipboard.");
  } catch (error) {
    showToast("Clipboard unavailable. Copy the page URL from your browser.");
  }
});

if (typeof initSqlJs !== "function") {
  setConnection("failed", "SQLite library unavailable");
  showMessage("Could not load the SQLite library. Check your internet connection and reload the page.", "error", "Error", "Database unavailable");
} else {
  initSqlJs({
    locateFile: (file) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${file}`
  }).then((SQL) => {
    database = seedDatabase(SQL);
    setConnection("connected", "Connected · local database");
    runQuery();
  }).catch((error) => {
    setConnection("failed", "Database failed to load");
    showMessage(`Could not initialize SQLite: ${error.message}`, "error", "Error", "Database unavailable");
  });
}
