# Liquidbounce Miniblox Bootstrapper

Bootstrapper for managing and launching the Liquidbounce Miniblox client.

## Features

- Automatic client updates from GitHub Releases
- Userscript version management
- Configuration stored in AppData
- Simple GUI launcher

## Setup

```bash
npm install
```

## Run

```bash
npm start
```

## Build

```bash
npm run build
```

The portable executable will be generated in the `dist` folder.

## GitHub Repository Structure

Your GitHub repository should contain:

### version.json
```json
{
  "latest": "1.0.0",
  "url": "https://github.com/username/repo/releases/latest/download/Miniblox.exe"
}
```

### userscripts.json
```json
{
  "versions": [
    {
      "name": "Stable",
      "url": "https://example.com/script/stable.user.js",
      "desc": "Stable version for normal use",
      "updated": "2025-10-04"
    },
    {
      "name": "Dev",
      "url": "https://example.com/script/dev.user.js",
      "desc": "Development version for testing",
      "updated": "2025-10-05"
    }
  ]
}
```

## Directory Structure

```
BootStrapper-LiquidbounceforMiniblox/
├── main.js
├── preload.js
├── package.json
├── renderer/
│   ├── index.html
│   └── style.css
└── app/
    ├── Miniblox.exe (downloaded by bootstrapper)
    └── version.txt
```

## Configuration

User configuration is stored at:
- Windows: `%AppData%\miniblox-app\config.json`

```json
{
  "userscriptUrl": "https://example.com/script.js"
}
```
