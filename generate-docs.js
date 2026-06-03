const fs   = require("fs");
const path = require("path");

const ROOT     = process.cwd();
const IGNORE   = ["node_modules", ".git", ".next", "dist", "build", "coverage"];
const CODE_EXT = [".ts", ".tsx", ".js", ".jsx", ".prisma"];

function shouldIgnore(p) { return IGNORE.some(x => p.includes(x)); }

function walk(dir, files = []) {
  if (shouldIgnore(dir)) return files;
  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    if (shouldIgnore(full)) continue;
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, files);
    else if (CODE_EXT.includes(path.extname(full))) files.push(full);
  }
  return files;
}

function getTree(dir, prefix = "") {
  let output = "";
  const items = fs.readdirSync(dir).filter(i => !IGNORE.includes(i)).sort();
  items.forEach((item, index) => {
    const full   = path.join(dir, item);
    const isLast = index === items.length - 1;
    output += `${prefix}${isLast ? "└── " : "├── "}${item}\n`;
    if (fs.statSync(full).isDirectory()) {
      output += getTree(full, prefix + (isLast ? "    " : "│   "));
    }
  });
  return output;
}

function detectRoutes(files) {
  const routes = [];
  files.forEach(file => {
    const content = fs.readFileSync(file, "utf8");
    const matches = content.matchAll(/router\.(get|post|put|delete|patch)\(["'`](.*?)["'`]/g);
    for (const match of matches) {
      routes.push({
        method: match[1].toUpperCase(),
        path:   match[2],
        file:   path.relative(ROOT, file).replace(/\\/g, "/"),
      });
    }
  });
  return routes;
}

function detectFrontendPages(files) {
  return files
    .filter(f => f.includes(`${path.sep}app${path.sep}`) && path.basename(f) === "page.tsx")
    .map(f => {
      const appRoot = path.join(ROOT, "frontend", "app");
      let route = path.relative(appRoot, f).replace(/\\/g, "/").replace("/page.tsx", "").replace("page.tsx", "");
      return route ? `/${route}` : "/";
    });
}

function prismaToMermaid() {
  const schemaPath = path.join(ROOT, "backend", "prisma", "schema.prisma");
  if (!fs.existsSync(schemaPath)) {
    return "erDiagram\n  SCHEMA_NOT_FOUND {\n    string message\n  }";
  }

  const schema = fs.readFileSync(schemaPath, "utf8");
  const modelMatches = [...schema.matchAll(/model\s+(\w+)\s+\{([\s\S]*?)\}/g)];

  const typeMap = {
    String: "string", Int: "int", Boolean: "boolean",
    DateTime: "datetime", Float: "float", Decimal: "float",
  };

  const lines = ["erDiagram"];

  modelMatches.forEach(match => {
    const model  = match[1];
    const body   = match[2];
    const fields = [];

    body.split("\n").map(l => l.trim()).filter(Boolean).forEach(line => {
      if (line.startsWith("//") || line.startsWith("/*") ||
          line.startsWith("*")  || line.startsWith("@")) return;
      const parts   = line.split(/\s+/);
      const field   = parts[0];
      const rawType = parts[1];
      if (!field || !rawType) return;
      if (rawType.includes("[]") || line.includes("@relation")) return;
      const cleanType   = rawType.replace("?", "");
      const mermaidType = typeMap[cleanType];
      if (!mermaidType) return;
      fields.push(`    ${mermaidType} ${field}`);
    });

    lines.push(`  ${model} {`);
    fields.forEach(f => lines.push(f));
    lines.push("  }");
  });

  const has = name => schema.includes(`model ${name}`);
  if (has("User")       && has("Lead"))    lines.push('  User ||--o{ Lead : "assigned"');
  if (has("UploadFile") && has("Lead"))    lines.push('  UploadFile ||--o{ Lead : "contains"');
  if (has("Lead")       && has("CallLog")) lines.push('  Lead ||--o{ CallLog : "has"');
  if (has("User")       && has("CallLog")) lines.push('  User ||--o{ CallLog : "creates"');
  if (has("User")       && has("Report"))  lines.push('  User ||--o{ Report : "generates"');

  return lines.join("\n");
}

function routesMermaid(routes) {
  const lines = [
    "flowchart TD",
    '  Frontend["Next.js Frontend"]',
    '  API["Express API"]',
    '  DB[("PostgreSQL")]',
    "  Frontend --> API",
    "  API --> DB",
  ];
  routes.forEach((route, i) => {
    const label = `${route.method} ${route.path}`.replace(/"/g, "'");
    lines.push(`  R${i}["${label}"]`);
    lines.push(`  API --> R${i}`);
  });
  return lines.join("\n");
}

function frontendMermaid(pages) {
  const lines = [
    "flowchart LR",
    '  App["Next.js App"]',
  ];
  pages.forEach((page, i) => {
    lines.push(`  P${i}["${page}"]`);
    lines.push(`  App --> P${i}`);
  });
  return lines.join("\n");
}

function generateHTML(tree, routes, pages, erd, apiFlow, frontEnd) {
  const methodColor = {
    GET: "#22c55e", POST: "#3b82f6", PUT: "#f59e0b",
    DELETE: "#ef4444", PATCH: "#a855f7",
  };

  const routeRows = routes.map(r => `
    <tr>
      <td><span class="badge" style="background:${methodColor[r.method] || "#64748b"}">${r.method}</span></td>
      <td><code>${r.path}</code></td>
      <td><code class="file">${r.file}</code></td>
    </tr>`).join("");

  const pageItems = pages.map(p => `<li><code>${p}</code></li>`).join("");
  const now = new Date().toLocaleString();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>CRM Dashboard — Documentation</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0f172a; color: #e2e8f0; line-height: 1.6; }
    .layout { display: flex; min-height: 100vh; }
    nav { width: 240px; background: #1e293b; border-right: 1px solid #334155; padding: 28px 0; position: fixed; top: 0; left: 0; bottom: 0; overflow-y: auto; z-index: 100; }
    nav .logo { font-size: 15px; font-weight: 700; color: #f8fafc; padding: 0 20px 24px; border-bottom: 1px solid #334155; display: flex; align-items: center; gap: 10px; }
    nav .logo span { background: #B8112D; color: #fff; width: 30px; height: 30px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; flex-shrink: 0; }
    nav ul { list-style: none; padding: 16px 0; }
    nav ul li a { display: flex; align-items: center; gap: 10px; padding: 10px 20px; color: #94a3b8; text-decoration: none; font-size: 13.5px; font-weight: 500; border-left: 3px solid transparent; transition: all 0.15s; }
    nav ul li a:hover, nav ul li a.active { color: #f8fafc; background: #0f172a; border-left-color: #B8112D; }
    main { margin-left: 240px; flex: 1; padding: 40px; max-width: calc(100vw - 240px); }
    .page-header { margin-bottom: 40px; padding-bottom: 24px; border-bottom: 1px solid #1e293b; }
    .page-header h1 { font-size: 28px; font-weight: 700; color: #f8fafc; }
    .page-header p { color: #64748b; font-size: 14px; margin-top: 6px; }
    .badge-generated { display: inline-flex; align-items: center; gap: 6px; background: #1e293b; border: 1px solid #334155; color: #94a3b8; font-size: 12px; padding: 4px 12px; border-radius: 999px; margin-top: 12px; }
    .badge-generated::before { content: ""; width: 6px; height: 6px; background: #22c55e; border-radius: 50%; display: inline-block; }
    section { margin-bottom: 48px; scroll-margin-top: 24px; }
    section h2 { font-size: 18px; font-weight: 600; color: #f1f5f9; margin-bottom: 16px; display: flex; align-items: center; gap: 10px; }
    section h2::after { content: ""; flex: 1; height: 1px; background: #1e293b; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 24px; overflow: auto; }
    .tree { font-family: "Courier New", monospace; font-size: 13px; color: #94a3b8; white-space: pre; line-height: 1.7; }
    .diagram-wrap { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 32px 24px; overflow: auto; display: flex; align-items: center; justify-content: center; min-height: 200px; }
    .mermaid { width: 100%; }
    table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
    thead tr { background: #0f172a; border-bottom: 1px solid #334155; }
    th { text-align: left; padding: 12px 16px; color: #64748b; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
    td { padding: 12px 16px; border-bottom: 1px solid #1e293b; color: #cbd5e1; vertical-align: middle; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: #0f172a; }
    .badge { display: inline-flex; align-items: center; justify-content: center; padding: 3px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; color: #fff; letter-spacing: 0.04em; }
    code { background: #0f172a; color: #7dd3fc; padding: 2px 8px; border-radius: 6px; font-size: 12.5px; font-family: "Courier New", monospace; }
    code.file { color: #a5b4fc; }
    .pages-list { list-style: none; display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
    .pages-list li { background: #0f172a; border: 1px solid #334155; border-radius: 10px; padding: 10px 14px; font-size: 13px; color: #94a3b8; }
    .pages-list li code { background: transparent; color: #7dd3fc; padding: 0; }
    .stats { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; margin-bottom: 40px; }
    .stat-card { background: #1e293b; border: 1px solid #334155; border-radius: 14px; padding: 18px; }
    .stat-card .num { font-size: 28px; font-weight: 700; color: #f8fafc; }
    .stat-card .lbl { font-size: 12px; color: #64748b; margin-top: 4px; }
    .accent { color: #B8112D; }
  </style>
</head>
<body>
<div class="layout">
  <nav>
    <div class="logo"><span>C</span> CRM Docs</div>
    <ul>
      <li><a href="#overview" class="active">📊 Overview</a></li>
      <li><a href="#structure">📁 Project Structure</a></li>
      <li><a href="#erd">🗄️ Database ERD</a></li>
      <li><a href="#apiflow">⚡ API Flow</a></li>
      <li><a href="#pages">🖥️ Frontend Pages</a></li>
      <li><a href="#routes">🔗 API Routes</a></li>
    </ul>
  </nav>
  <main>
    <div class="page-header" id="overview">
      <h1>CRM Dashboard Documentation</h1>
      <p>Auto-generated from project source files.</p>
      <div class="badge-generated">Auto-generated · ${now}</div>
    </div>
    <div class="stats">
      <div class="stat-card"><div class="num accent">${routes.length}</div><div class="lbl">API Routes</div></div>
      <div class="stat-card"><div class="num accent">${pages.length}</div><div class="lbl">Frontend Pages</div></div>
      <div class="stat-card"><div class="num accent">${routes.filter(r => r.method === "GET").length}</div><div class="lbl">GET Routes</div></div>
      <div class="stat-card"><div class="num accent">${routes.filter(r => r.method === "POST").length}</div><div class="lbl">POST Routes</div></div>
    </div>
    <section id="structure">
      <h2>📁 Project Structure</h2>
      <div class="card"><pre class="tree">${tree}</pre></div>
    </section>
    <section id="erd">
      <h2>🗄️ Database ERD</h2>
      <div class="diagram-wrap"><div class="mermaid">${erd}</div></div>
    </section>
    <section id="apiflow">
      <h2>⚡ Backend API Flow</h2>
      <div class="diagram-wrap"><div class="mermaid">${apiFlow}</div></div>
    </section>
    <section id="pages">
      <h2>🖥️ Frontend Pages</h2>
      <div class="diagram-wrap" style="margin-bottom:20px"><div class="mermaid">${frontEnd}</div></div>
      <div class="card"><ul class="pages-list">${pageItems}</ul></div>
    </section>
    <section id="routes">
      <h2>🔗 API Routes</h2>
      <div class="card" style="padding:0;overflow:hidden">
        <table>
          <thead><tr><th>Method</th><th>Path</th><th>File</th></tr></thead>
          <tbody>${routeRows}</tbody>
        </table>
      </div>
    </section>
  </main>
</div>
<script>
  mermaid.initialize({
    startOnLoad: true,
    theme: "dark",
    themeVariables: {
      primaryColor: "#1e293b",
      primaryTextColor: "#e2e8f0",
      primaryBorderColor: "#334155",
      lineColor: "#B8112D",
      secondaryColor: "#0f172a",
      tertiaryColor: "#0f172a",
      fontFamily: "ui-sans-serif, system-ui, sans-serif",
    },
    er: { diagramPadding: 30 },
    flowchart: { curve: "basis", padding: 20 },
  });
  const sections = document.querySelectorAll("section, .page-header");
  const links    = document.querySelectorAll("nav a");
  window.addEventListener("scroll", () => {
    let current = "";
    sections.forEach(s => { if (window.scrollY >= s.offsetTop - 80) current = s.id; });
    links.forEach(a => { a.classList.toggle("active", a.getAttribute("href") === "#" + current); });
  });
</script>
</body>
</html>`;
}

function generateDocs() {
  const files    = walk(ROOT);
  const routes   = detectRoutes(files);
  const pages    = detectFrontendPages(files);
  const tree     = getTree(ROOT);
  const erd      = prismaToMermaid();
  const apiFlow  = routesMermaid(routes);
  const frontEnd = frontendMermaid(pages);

  const md = `# CRM Dashboard — Auto Documentation\n\n> Generated automatically. Do not edit manually.\n\n## Project Structure\n\`\`\`txt\n${tree}\`\`\`\n\n## Database ERD\n\`\`\`mermaid\n${erd}\n\`\`\`\n\n## Backend API Flow\n\`\`\`mermaid\n${apiFlow}\n\`\`\`\n\n## Frontend Pages\n\`\`\`mermaid\n${frontEnd}\n\`\`\`\n\n## API Routes\n| Method | Path | File |\n|--------|------|------|\n${routes.map(r => `| \`${r.method}\` | \`${r.path}\` | \`${r.file}\` |`).join("\n")}\n\n## Frontend Routes\n${pages.map(p => `- \`${p}\``).join("\n")}\n`;

  fs.writeFileSync(path.join(ROOT, "PROJECT.md"), md);
  fs.writeFileSync(path.join(ROOT, "PROJECT.html"), generateHTML(tree, routes, pages, erd, apiFlow, frontEnd));

  console.log("✅ PROJECT.md updated");
  console.log("✅ PROJECT.html updated — open in Chrome to view diagrams");
}

generateDocs();