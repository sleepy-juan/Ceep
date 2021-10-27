const { ipcRenderer } = require("electron");
var $ = require("jquery");

ipcRenderer.on("show-copy", (event, copy) => {
    $("#content").html(copy.text);
});
