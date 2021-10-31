const { ipcRenderer, clipboard } = require("electron");
var $ = require("jquery");

function updateList(history) {
    $("#list").empty();
    history.forEach((snapshot, idx) => {
        let { text, time, type, tags } = snapshot;
        todayMonth = new Date().getMonth() + 1;
        todayDate = new Date().getDate();

        time = new Date(time);
        month = time.getMonth() + 1;
        date = time.getDate();
        hours = time.getHours();
        minutes = new String(time.getMinutes());
        minutes = minutes.length === 1 ? "0" + minutes : minutes;

        $("#list").append(`<li class="item" data-id="${idx}">
            <p class="item-text">${text.length <= 200 ? text : text.slice(0, 200) + "..."}</p>
            <div class="item-meta">
                <span class="item-tags">
                    <span class="uk-badge item-type">${type}</span>
                    ${type === "color" ? `<span class="uk-badge" style="background-color: ${text}"></span>` : ""}
                    ${
                        tags.length <= 3
                            ? tags.map((t) => `<span class="uk-badge">${t}</span>`).join("")
                            : tags
                                  .slice(0, 3)
                                  .map((t) => `<span class="uk-badge">${t}</span>`)
                                  .join("") + `<span class="uk-badge" style="background-color: green">+${tags.length - 3}</span>`
                    }
                </span>
                <span class="item-time">${todayMonth === month && todayDate === date ? `${hours}:${minutes}` : `${month}.${date} ${hours}:${minutes}`}</span>
            </div>
        </li>`);
    });

    // $("li.item").on("click", function () {
    //     const id = $(this).attr("data-id") * 1;
    //     clipboard.writeText(history[id].text, "clipboard");
    // });

    $("li.item").on("click", function () {
        const id = $(this).attr("data-id") * 1;
        ipcRenderer.send("show-expand", history[id]);
    });
}

// once
let clipboardHistory = ipcRenderer.sendSync("clipboard-load");
updateList(clipboardHistory);

// listener
ipcRenderer.on("clipboard-updated", (event, history) => {
    clipboardHistory = history;
    updateList(history);
});

// search
$("#search").on("change keyup paste", function () {
    const keyword = $(this).val();
    let tempHistory = clipboardHistory.slice().filter((x) => x.text.includes(keyword) || x.type.includes(keyword));
    updateList(tempHistory);
});

window.addEventListener("contextmenu", (e) => {
    let item = e.path.filter((p) => ($(p).attr("class") ? $(p).attr("class").split(" ").includes("item") : false));
    if (item.length > 0) {
        e.preventDefault();

        item = $(item[0]);

        const id = item.attr("data-id") * 1;
        ipcRenderer.send("show-context-menu", clipboardHistory[id]);
    }
});
