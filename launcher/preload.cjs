const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopApi", {
  getBackendState: () => ipcRenderer.invoke("desktop:get-backend-state"),
  restartBackend: () => ipcRenderer.invoke("desktop:restart-backend"),
  saveImage: (input) => ipcRenderer.invoke("desktop:save-image", input),
  onBackendStateChanged: (callback) => {
    const handler = (_event, state) => callback(state);
    ipcRenderer.on("desktop:backend-state-changed", handler);
    return () => {
      ipcRenderer.removeListener("desktop:backend-state-changed", handler);
    };
  }
});
