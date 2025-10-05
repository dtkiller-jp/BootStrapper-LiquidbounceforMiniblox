const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  getConfig: () => ipcRenderer.invoke("getConfig"),
  setConfig: (data) => ipcRenderer.invoke("setConfig", data),
  getAvailableScripts: () => ipcRenderer.invoke("getAvailableScripts"),
  updateClient: () => ipcRenderer.invoke("updateClient"),
  launchClient: () => ipcRenderer.invoke("launchClient")
});
