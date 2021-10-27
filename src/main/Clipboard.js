/*
    Clipboard.js
    - a library for clipboard management
*/

const { clipboard, ipcMain } = require("electron");
const { htmlToText } = require("html-to-text");
const validator = require("validator");
const storage = require("electron-storage");
const fs = require("fs");

//----- Class Copy -----//
class Copy {
    #reTags = /^#([\w|가-힣|_])+$/;
    #reSpace = /\s+/;

    constructor(text, time) {
        this.text = text || "";
        this.time = typeof time === "string" ? time : time.toISOString();
        this.type = this.inferType();
        this.tags = this.inferTags();
        this.pinned = false;
    }

    // infer type from text
    inferType() {
        const imageExtensions = [".png", ".PNG", ".jpg", ".JPG", ".jpeg", ".JPEG"];

        let text = this.text
            .split(this.#reSpace)
            .filter((word) => validator.isHexColor(word) || !this.#reTags.test(word))
            .join(" ");

        if (
            validator.isEmail(text, {
                allow_display_name: true,
                require_tld: false,
            })
        )
            return "email";
        else if (validator.isIP(text)) return "ip";
        else if (validator.isURL(text)) {
            if (imageExtensions.filter((e) => text.endsWith(e)).length > 0) return "image";
            return "url";
        } else if (validator.isHexColor(text)) return "color";
        else if (imageExtensions.filter((e) => text.endsWith(e)).length > 0) return "image";
        else return "text";
    }

    // infer tag from text
    // only support english, korean, and _
    inferTags() {
        let tags = this.text.split(this.#reSpace).filter((tag) => !validator.isHexColor(tag) && this.#reTags.test(tag));
        tags = [...new Set(tags)];
        return tags;
    }

    // import from json
    static fromJSON(json) {
        let copy = new Copy(json.text, json.time);
        copy.pinned = json.pinned;
        return copy;
    }

    // export to raw
    static toRaw(text) {
        clipboard.writeText(text, "clipboard");
    }

    // export json
    json() {
        return {
            text: this.text,
            time: this.time,
            type: this.type,
            tags: this.tags,
            pinned: this.pinned,
        };
    }
}

//----- Class Clipboard -----//
class Clipboard {
    constructor(updateNotifier) {
        this.history = [];
        this.numUpdates = 0;
        this.watcherID = -1;
        this.updateNotifier = updateNotifier;
    }

    //----- Load and Save -----//

    // load from database
    loadFromDB() {
        storage.get("data", (err, data) => {
            if (err) {
                console.log(err);
                data = [];
            }
            data = data.map((h) => Copy.fromJSON(h));

            // get rid of duplicates
            if (this.history.length > 0 && data.length > 0 && this.history[this.history.length - 1].text === data[0].text) data = data.slice(1);

            // merge
            this.history = this.history.concat(data);

            // notify
            this.updateNotifier();
        });
    }

    // save to database
    saveToDB() {
        storage.set(
            "data",
            this.history.map((h) => h.json()),
            (err) => {
                if (err) console.log(err);
            }
        );
    }

    // save to file
    saveToFile(filepath) {
        let content = "text, time, pinned, type, tags\n";
        this.history.forEach((h) => {
            content += '"' + h.text + '"' + ",";
            content += '"' + h.time + '"' + ",";
            content += '"' + h.pinned + '"' + ",";
            content += '"' + h.type + '"' + ",";
            content += '"' + h.tags.join(",") + '"' + "\n";
        });
        if (!filepath.endsWith(".csv")) filepath += ".csv";

        fs.writeFileSync(filepath, content, "utf-8");
    }

    //----- Watcher -----//

    // beginWatch
    beginWatch(frequency) {
        frequency = frequency || 100;
        this.watcherID = setInterval(() => {
            let text = clipboard.readText("clipboard");
            text = htmlToText(text);
            let time = new Date();

            if (text && (this.history.length === 0 || text !== this.history[0].text)) {
                this.numUpdates++;
                this.history.unshift(new Copy(text, time));
                this.saveToDB();
                this.updateNotifier();
            }
        }, frequency);
    }

    // stopWatch
    stopWatch() {
        if (this.watcherID !== -1) clearInterval(this.watcherID);
    }

    //----- Management -----//

    // removeCopy
    removeCopy(time) {
        if (time === this.history[0].time) clipboard.clear("clipboard");

        this.history = this.history.filter((h) => h.time !== time);
        this.saveToDB();
        this.updateNotifier();
    }

    // clearClipboard
    clearClipboard() {
        clipboard.clear("clipboard");
        this.numUpdates = 0;
        this.history = [];
        this.saveToDB();
        this.updateNotifier();
    }

    // pinCopy
    pinCopy(time) {
        let copy = this.history.find((c) => c.time === time);
        copy.pinned = true;
        this.saveToDB();
        this.updateNotifier();
    }

    // unpinCopy
    unpinCopy(time) {
        let copy = this.history.find((c) => c.time === time);
        copy.pinned = false;
        this.saveToDB();
        this.updateNotifier();
    }

    //----- Communication -----//
    returnOn(channel) {
        ipcMain.on(channel, (event) => {
            event.returnValue = this.history;
        });
    }
}

module.exports = {
    Copy,
    Clipboard,
};
