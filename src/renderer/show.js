const { ipcRenderer } = require("electron");
var $ = require("jquery");

ipcRenderer.on("show-copy", (event, copy) => {
    $("#content").html(copy.html);
    $("body").css("background-color", $("#content > div").css("background-color"));
    // $("#header").css("background-color", $("#content > div").css("background-color"));
});
