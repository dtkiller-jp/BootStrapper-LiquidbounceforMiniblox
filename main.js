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
const CLIENT_DIR = path.join(process.cwd(), "app");
const CLIENT_EXE = path.join(CLIENT_DIR, "Miniblox.exe");
const VERSION_FILE = path.join(CLIENT_DIR, "version.txt");

// GitHub リポジトリ設定
const GITHUB_USER = "progmem-cc";
const REPO = "miniblox.impact.client.updatedv2";
const VERSION_URL = `https://raw.githubusercontent.com/dtkiller-jp/liquidbouns-for-miniblox-WINDOWS/refs/heads/main/version.json`;
const USERSCRIPTS_URL = `https://raw.githubusercontent.com/dtkiller-jp/liquidbouns-for-miniblox-WINDOWS/refs/heads/main/userscripts.json`;

let mainWindow;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 500,
    height: 400,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
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
      userscriptUrl: "https://raw.githubusercontent.com/progmem-cc/miniblox.impact.client.updatedv2/refs/heads/main/vav4inject.js"
    }, null, 2));
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
}

ipcMain.handle("getConfig", () => ensureConfig());

ipcMain.handle("setConfig", (_, data) => {
  const current = ensureConfig();
  const updated = { ...current, ...data };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 2));
  return updated;
});

// --- Userscript一覧取得 ---
ipcMain.handle("getAvailableScripts", async () => {
  try {
    const data = await fetchJSON(USERSCRIPTS_URL);
    return data.versions || [];
  } catch (e) {
    console.error("userscripts.json 読込失敗:", e);
    return [];
  }
});

// --- クライアント更新 ---
ipcMain.handle("updateClient", async () => {
  try {
    const localVersion = fs.existsSync(VERSION_FILE)
      ? fs.readFileSync(VERSION_FILE, "utf8").trim()
      : "0.0.0";

    const data = await fetchJSON(VERSION_URL);
    const { latest, url } = data;

    if (localVersion === latest) return "すでに最新版です。";

    // クライアントディレクトリを作成
    if (!fs.existsSync(CLIENT_DIR)) {
      fs.mkdirSync(CLIENT_DIR, { recursive: true });
    }

    // EXEを直接ダウンロード
    const buffer = await downloadFile(url);
    fs.writeFileSync(CLIENT_EXE, buffer);
    fs.writeFileSync(VERSION_FILE, latest);

    return `更新完了 (${latest})`;
  } catch (e) {
    console.error("更新エラー:", e);
    return "更新に失敗しました: " + e.message;
  }
});

// --- クライアント起動 ---
ipcMain.handle("launchClient", async () => {
  try {
    // クライアントが存在するか確認
    if (!fs.existsSync(CLIENT_EXE)) {
      throw new Error("クライアントが見つかりません。先にアップデートを実行してください。");
    }

    // config.json を確認・URLを上書き
    const config = ensureConfig();
    if (!config.userscriptUrl || config.userscriptUrl.trim() === "") {
      throw new Error("Userscript URL が設定されていません。");
    }

    // 設定を保存
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

    // クライアント起動
    spawn(CLIENT_EXE, [], { 
      detached: true, 
      stdio: "ignore",
      cwd: CLIENT_DIR
    }).unref();
    
    // Bootstrapperを終了
    setTimeout(() => app.quit(), 500);
    
    return "起動しました";
  } catch (e) {
    throw new Error(e.message);
  }
});

// --- ヘルパー関数 ---
function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on("error", reject);
  });
}

function downloadFile(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const chunks = [];
      res.on("data", chunk => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks)));
    }).on("error", reject);
  });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  app.quit();
});
