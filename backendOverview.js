#!/usr/bin/env node
import fs from "fs";
import path from "path";
import chalk from "chalk";
import { fileURLToPath } from "url";
import { createObjectCsvWriter } from "csv-writer";

// Config
const BACKEND_ROOT = "./";
const IGNORE_DIRS = ["node_modules", ".git", "test", "tests", "coverage"];
const FILE_EXTENSIONS = [".js", ".ts"];
const CSV_PATH = "./backend_structure.csv";

// Helpers
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Color Map
const COLORS = {
  route: chalk.magentaBright,
  model: chalk.blueBright,
  controller: chalk.greenBright,
  middleware: chalk.yellowBright,
  config: chalk.cyanBright,
  service: chalk.whiteBright,
  util: chalk.gray,
  default: chalk.white,
};

console.log("\n🧩 Backend Structure Overview\n");

const allCsvRows = [];

async function analyzeBackend() {
  try {
    const structure = await scanDirectory(BACKEND_ROOT, 0);
    displayStructure(structure);
    await writeCsv(allCsvRows);
    console.log(chalk.green(`\n📄 CSV file written to: ${CSV_PATH}`));
  } catch (err) {
    console.error(chalk.red("❌ Error:"), err);
  }
}

async function scanDirectory(dirPath, depth) {
  const name = path.basename(dirPath);
  const item = {
    name,
    path: dirPath,
    type: "directory",
    children: [],
    depth,
  };

  if (IGNORE_DIRS.includes(name) && depth > 0) return null;

  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        const child = await scanDirectory(fullPath, depth + 1);
        if (child) item.children.push(child);
      } else if (FILE_EXTENSIONS.includes(path.extname(entry.name))) {
        const fileType = determineFileType(entry.name);
        const stats = await fs.promises.stat(fullPath);
        const content = await fs.promises.readFile(fullPath, "utf-8");

        const fileObj = {
          name: entry.name,
          path: fullPath,
          type: fileType,
          size: stats.size,
          modified: stats.mtime,
          depth: depth + 1,
        };

        if (fileType === "controller") {
          fileObj.functions = extractControllerFunctions(content);
          fileObj.functions.forEach(fn =>
            allCsvRows.push(toCsvRow(fileObj, { function: fn }))
          );
        } else if (fileType === "route") {
          fileObj.routes = extractRouteMappings(content);
          fileObj.routes.forEach(rt =>
            allCsvRows.push(toCsvRow(fileObj, { route: rt }))
          );
        } else if (fileType === "model") {
          fileObj.fields = extractModelFields(content);
          fileObj.fields.forEach(f =>
            allCsvRows.push(toCsvRow(fileObj, { fieldName: f.name, fieldType: f.type }))
          );
        } else {
          allCsvRows.push(toCsvRow(fileObj));
        }

        item.children.push(fileObj);
      }
    }

    return item;
  } catch (err) {
    console.error(chalk.red(`Error in ${dirPath}:`), err);
    return null;
  }
}

function determineFileType(name) {
  const lower = name.toLowerCase();
  if (lower.includes("route") || lower.includes("router")) return "route";
  if (lower.includes("model")) return "model";
  if (lower.includes("controller")) return "controller";
  if (lower.includes("middleware")) return "middleware";
  if (lower.includes("config")) return "config";
  if (lower.includes("service")) return "service";
  if (lower.includes("util")) return "util";
  return "default";
}

function extractControllerFunctions(content) {
  const named = [...content.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)].map(m => m[1]);
  const constExports = [...content.matchAll(/export\s+const\s+(\w+)/g)].map(m => m[1]);
  const defaultExport = [...content.matchAll(/export\s+default\s+function\s*(\w*)/g)].map(m => m[1] || "default");
  return [...named, ...constExports, ...defaultExport];
}

function extractRouteMappings(content) {
  const lines = content.split("\n");
  const routeRegex = /router\.(get|post|put|delete|patch)\(['"`](.*?)['"`],\s*([a-zA-Z0-9_]+)/;
  const useRegex = /router\.use\(['"`](.*?)['"`]/;
  const imports = [...content.matchAll(/import\s+(\w+)\s+from\s+['"`](.*?)['"`]/g)].map(
    ([_, name, path]) => `📥 import: ${name} from "${path}"`
  );

  const routes = [...imports];

  for (let line of lines) {
    const match = line.match(routeRegex);
    if (match) {
      const [, method, path, handler] = match;
      routes.push(`${method.toUpperCase()} ${path} → ${handler}()`);
    }

    const use = line.match(useRegex);
    if (use) {
      routes.push(`USE ${use[1]}`);
    }
  }

  return routes;
}

function extractModelFields(content) {
  const fieldRegex = /(\w+):\s*{[^}]*type:\s*(\w+)/g;
  const fields = [];
  let match;
  while ((match = fieldRegex.exec(content)) !== null) {
    fields.push({ name: match[1], type: match[2] });
  }
  return fields;
}

function displayStructure(node, indent = 0) {
  if (!node) return;
  const indentStr = " ".repeat(indent * 2);
  const color = COLORS[node.type] || COLORS.default;

  if (node.type === "directory") {
    console.log(`${indentStr}📁 ${node.name}/`);
    node.children.forEach(child => displayStructure(child, indent + 1));
  } else {
    console.log(
      color(
        `${indentStr}${getFileIcon(node.type)} ${node.name} [${node.size} bytes, modified: ${node.modified.toLocaleString()}]`
      )
    );

    if (node.type === "controller" && node.functions?.length) {
      node.functions.forEach(fn => {
        console.log(color(`${indentStr}   └─ 🎯 ${fn}()`));
      });
    }

    if (node.type === "route" && node.routes?.length) {
      node.routes.forEach(route => {
        const icon = route.startsWith("USE") ? "➡️" : route.includes("import") ? "📥" : "🔸";
        console.log(color(`${indentStr}   └─ ${icon} ${route}`));
      });
    }

    if (node.type === "model" && node.fields?.length) {
      node.fields.forEach(f => {
        console.log(COLORS.model(`${indentStr}   └─ 🧬 ${f.name} (${f.type})`));
      });
    }
  }
}

function getFileIcon(type) {
  const icons = {
    route: "🛣️",
    model: "📦",
    controller: "🎮",
    middleware: "🛡️",
    config: "⚙️",
    service: "🔧",
    util: "🛠️",
    default: "📄",
  };
  return icons[type] || icons.default;
}

function toCsvRow(fileObj, extras = {}) {
  return {
    Type: fileObj.type,
    "File Name": fileObj.name,
    Path: fileObj.path,
    "Size (bytes)": fileObj.size,
    "Last Modified": fileObj.modified.toISOString(),
    "Field Name": extras.fieldName || "",
    "Field Type": extras.fieldType || "",
    Function: extras.function || "",
    Route: extras.route || "",
  };
}

async function writeCsv(rows) {
  const csvWriter = createObjectCsvWriter({
    path: CSV_PATH,
    header: [
      { id: "Type", title: "Type" },
      { id: "File Name", title: "File Name" },
      { id: "Path", title: "Path" },
      { id: "Size (bytes)", title: "Size (bytes)" },
      { id: "Last Modified", title: "Last Modified" },
      { id: "Field Name", title: "Field Name" },
      { id: "Field Type", title: "Field Type" },
      { id: "Function", title: "Function" },
      { id: "Route", title: "Route" },
    ],
  });

  await csvWriter.writeRecords(rows);
}

analyzeBackend();
