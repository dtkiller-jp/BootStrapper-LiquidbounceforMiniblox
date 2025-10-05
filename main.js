import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import fs from "fs";
import os from "os";
import { spawn } from "child_process";
import https from "https";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const APP_NAME = "miniblox-app";
const CONFIG_DIR = path.join(os.homedir(), "AppData", "Roaming", APP_NAME);
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");
const CLIENT_DIR = path.join(CONFIG_DIR, "client");
const CLIENT_EXE = path.join(CLIENT_DIR, "MinibloxClient.exe");
const VERSION_FILE = path.join(CLIENT_DIR, "version.txt");

// GitHub リポジトリ設定
const GITHUB_USER = "dtkiller-jp";
const REPO = "liquidbouns-for-miniblox-WINDOWS";
const VERSION_URL = `https://raw.githubusercontent.com/${GITHUB_USER}/${REPO}/main/version.json`;
const USERSCRIPTS_URL = `https://raw.githubusercontent.com/${GITHUB_USER}/${REPO}/main/userscripts.json`;

console.log("=== Miniblox Launcher Configuration ===");
console.log("VERSION_URL:", VERSION_URL);
console.log("USERSCRIPTS_URL:", USERSCRIPTS_URL);
console.log("======================================");

let mainWindow;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 500,
    height: 400,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.setMenu(null);
  await mainWindow.loadFile("renderer/index.html");
}

// --- Config管理 ---
function ensureConfig() {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
  if (!fs.existsSync(CONFIG_PATH)) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify({
      userscriptUrl: "https://raw.githubusercontent.com/progmem-cc/miniblox.impact.client.updatedv2/refs/heads/main/vav4inject.js",
      selectedVersion: "latest"
    }, null, 2));
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
}

ipcMain.handle("getConfig", () => {
  const config = ensureConfig();
  console.log("Config loaded:", config);
  return config;
});

ipcMain.handle("setConfig", (_, data) => {
  const current = ensureConfig();
  const updated = { ...current, ...data };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 2));
  console.log("Config updated:", updated);
  return updated;
});

// --- Userscript一覧取得 ---
ipcMain.handle("getAvailableScripts", async () => {
  try {
    console.log("Fetching userscripts from:", USERSCRIPTS_URL);
    const data = await fetchJSON(USERSCRIPTS_URL);
    console.log("Userscripts loaded:", data);
    return data.versions || [];
  } catch (e) {
    console.error("Failed to load userscripts.json:", e);
    return [];
  }
});

// --- クライアント更新（手動用・後方互換性のため残す） ---
ipcMain.handle("updateClient", async () => {
  try {
    const localVersion = fs.existsSync(VERSION_FILE)
      ? fs.readFileSync(VERSION_FILE, "utf8").trim()
      : "0.0.0";

    const data = await fetchJSON(VERSION_URL);
    const { latest, url } = data;

    if (localVersion === latest) return "Already up to date.";

    // クライアントディレクトリを作成
    if (!fs.existsSync(CLIENT_DIR)) {
      fs.mkdirSync(CLIENT_DIR, { recursive: true });
    }

    // EXEをダウンロード
    const buffer = await downloadFile(url);
    fs.writeFileSync(CLIENT_EXE, buffer);
    fs.writeFileSync(VERSION_FILE, latest);

    return `Updated to ${latest}`;
  } catch (e) {
    console.error("Update error:", e);
    return "Update failed: " + e.message;
  }
});

// --- クライアント起動（自動更新付き） ---
ipcMain.handle("launchClient", async () => {
  try {
    // バージョンチェック
    const localVersion = fs.existsSync(VERSION_FILE)
      ? fs.readFileSync(VERSION_FILE, "utf8").trim()
      : "0.0.0";

    let needsUpdate = false;
    let latestVersion = localVersion;

    // クライアントが存在しない、または更新がある場合
    if (!fs.existsSync(CLIENT_EXE)) {
      needsUpdate = true;
    } else {
      try {
        const data = await fetchJSON(VERSION_URL);
        latestVersion = data.latest;
        if (localVersion !== latestVersion) {
          needsUpdate = true;
        }
      } catch (e) {
        console.warn("Version check failed, using existing client:", e);
      }
    }

    // 更新が必要な場合
    if (needsUpdate) {
      console.log(`Updating client from ${localVersion} to ${latestVersion}...`);

      const data = await fetchJSON(VERSION_URL);
      const { latest, url } = data;

      // クライアントディレクトリを作成
      if (!fs.existsSync(CLIENT_DIR)) {
        fs.mkdirSync(CLIENT_DIR, { recursive: true });
      }

      // EXEをダウンロード
      const buffer = await downloadFile(url);
      fs.writeFileSync(CLIENT_EXE, buffer);
      fs.writeFileSync(VERSION_FILE, latest);

      console.log(`Client updated to ${latest}`);
    }

    // config.json を確認
    const config = ensureConfig();
    if (!config.userscriptUrl || config.userscriptUrl.trim() === "") {
      throw new Error("Userscript URL is not set.");
    }

    // 設定を保存（クライアントが読み込む）
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

    console.log("Launching client:", CLIENT_EXE);
    console.log("Config:", config);

    // クライアント起動
    const child = spawn(CLIENT_EXE, [], {
      detached: true,
      stdio: "ignore",
      cwd: CLIENT_DIR,
      shell: false
    });

    child.unref();

    // Launcherを終了
    setTimeout(() => app.quit(), 1000);

    return needsUpdate ? `Updated to ${latestVersion} and launched` : "Launched";
  } catch (e) {
    console.error("Launch error:", e);
    throw new Error(e.message);
  }
});

// --- ヘルパー関数 ---
function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'MinibloxLauncher/1.0'
      }
    };

    https.get(url, options, (res) => {
      // リダイレクト対応
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchJSON(res.headers.location).then(resolve).catch(reject);
      }

      if (res.statusCode !== 200) {
        console.error(`HTTP Error: ${res.statusCode} for ${url}`);
        return reject(new Error(`HTTP ${res.statusCode}`));
      }

      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          console.log(`Fetched JSON from ${url}:`, data.substring(0, 100));
          resolve(JSON.parse(data));
        } catch (e) {
          console.error("JSON parse error:", e);
          reject(e);
        }
      });
      res.on("error", reject);
    }).on("error", (e) => {
      console.error(`Network error for ${url}:`, e);
      reject(e);
    });
  });
}

function downloadFile(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'MinibloxLauncher/1.0'
      }
    };

    https.get(url, options, (res) => {
      // リダイレクト対応
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadFile(res.headers.location).then(resolve).catch(reject);
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }

      const chunks = [];
      res.on("data", chunk => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    }).on("error", reject);
  });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  app.quit();
});
