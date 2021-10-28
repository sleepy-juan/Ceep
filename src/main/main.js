/*
    main.js

    - entry point for the program
*/

const path = require("path");
const { app, BrowserWindow, ipcMain, nativeImage, Tray, Menu, dialog, clipboard } = require("electron");

let { Copy, Clipboard } = require("./Clipboard.js");
const storage = require("electron-storage");

//----- Clipboard -----//
let clip = new Clipboard(() => {
    if (tray) tray.setContextMenu(createMenu(clip.history));
    if (window) {
        window.webContents.send("clipboard-updated", clip.history); // notify renderer
        if (window.isFocused()) clip.numUpdates = 0;
    }
    if (!window || !window.isFocused()) {
        if (clip.numUpdates === 0) app.dock.setBadge("");
        else app.dock.setBadge(`${clip.numUpdates}`);
    }
});
clip.returnOn("clipboard-load");

//////////////////////////////////////////////////

//----- Tray -----//

let tray = null;

function createTray() {
    let tray = null;
    const icon = nativeImage.createFromPath(path.join(__dirname, "../../assets/", "/trayicon.png"));
    tray = new Tray(icon.resize({ width: 16 }));
    tray.setContextMenu(createMenu([]));
    return tray;
}

function createPopupMenu(arg) {
    return Menu.buildFromTemplate([
        {
            label: "Copy",
            click: () => {
                Copy.toRaw(arg.text);
            },
        },
        {
            label: "Remove",
            click: () => {
                clip.removeCopy(arg.time);
            },
        },
        {
            label: "Pin",
            click: () => {
                clip.pinCopy(arg.time);
            },
        },
        {
            label: "Expand",
            click: () => {
                let showWindow = new BrowserWindow({
                    width: 500,
                    height: 500,
                    webPreferences: {
                        nodeIntegration: true,
                        contextIsolation: false,
                        enableRemoteModule: true,
                    },
                    trafficLightPosition: {
                        x: 15,
                        y: 15,
                    },
                    titleBarStyle: "hidden",
                });

                showWindow.loadFile(path.join(__dirname, "../renderer", "/show.html")).then(() => {
                    showWindow.webContents.send("show-copy", arg);
                });
                showWindow.on("closed", function () {
                    showWindow = null;
                });
            },
        },
    ]);
}

function createMenu(history) {
    pinned = history
        .filter((h) => h.pinned)
        .map((pin) => ({
            label: pin.text.length > 50 ? pin.text.slice(0, 50) + "..." : pin.text,
            click: () => {
                Copy.toRaw(pin.text);
            },
        }));
    if (pinned.length > 0)
        pinned.unshift({
            label: "Pinned",
            sublabel: "test",
        });

    history = history.slice(0, 10).map((h) => ({
        label: h.text.length > 50 ? h.text.slice(0, 50) + "..." : h.text,
        click: () => {
            Copy.toRaw(h.text);
        },
        type: "radio",
    }));
    if (history.length > 0)
        history.unshift({
            label: "History",
        });

    let template = [
        {
            label: "Show",
            click: () => {
                if (window) window.show();
                else createWindow();
            },
        },
        { type: "separator" },
        ...pinned,
        { type: "separator" },
        ...history,
        { type: "separator" },
        {
            label: "Clear",
            click: () => {
                clip.clearClipboard();
            },
        },
        {
            label: "Export",
            click: () => {
                // new Notification({ title: "Exporting", body: "Test Notification" }).show();
                dialog.showSaveDialog(null).then((file) => {
                    clip.saveToFile(file.filePath);
                });
            },
        },
        {
            label: "Quit",
            click: () => {
                app.quit();
            },
        },
    ];

    return Menu.buildFromTemplate(template);
}

//----- Popup Menu -----//
ipcMain.on("show-context-menu", (event, arg) => {
    const menu = createPopupMenu(arg);
    menu.popup(BrowserWindow.fromWebContents(event.sender));
});

//----- Main Window -----//

let window = null;
let windowRect = {
    width: 350,
    height: 600,
    x: null,
    y: null,
};

function createWindow() {
    if (!tray) tray = createTray();

    window = new BrowserWindow({
        width: windowRect.width,
        height: windowRect.height,
        minWidth: 350,
        minHeight: 300,
        x: windowRect.x && windowRect.y ? windowRect.x : undefined,
        y: windowRect.x && windowRect.y ? windowRect.y : undefined,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
        },
        titleBarStyle: "hidden",
        trafficLightPosition: {
            x: 15,
            y: 15,
        },
    });

    window.loadFile(path.join(__dirname, "../renderer", "/index.html"));
    window.on("closed", function () {
        window = null;
    });
    window.on("resize", function () {
        var size = window.getSize();
        windowRect.width = size[0];
        windowRect.height = size[1];

        storage.set("preference", windowRect);
    });
    window.on("move", function () {
        var pos = window.getPosition();
        windowRect.x = pos[0];
        windowRect.y = pos[1];

        storage.set("preference", windowRect);
    });
    window.on("focus", function () {
        clip.numUpdates = 0;
        app.dock.setBadge("");
    });
    app.on("activate", function () {
        if (window) window.show();
        else createWindow();
    });
}

app.on("ready", () => {
    storage.get("preference", (err, preference) => {
        if (err) console.log(err);
        if (!preference) preference = {};
        windowRect.width = preference.width || 350;
        windowRect.height = preference.height || 600;
        windowRect.x = preference.x;
        windowRect.y = preference.y;

        createWindow();
    });

    clip.loadFromDB();
    clip.beginWatch(100);
});
app.on("window-all-closed", () => {
    // app.dock.hide();
});
