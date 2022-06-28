/*
* Copyright (c) {2021} torikulhabib (https://github.com/torikulhabib)
*
* This program is free software; you can redistribute it and/or
* modify it under the terms of the GNU General Public
* License as published by the Free Software Foundation; either
* version 2 of the License, or (at your option) any later version.
*
* This program is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
* General Public License for more details.
*
* You should have received a copy of the GNU General Public
* License along with this program; if not, write to the
* Free Software Foundation, Inc., 51 Franklin Street, Fifth Floor,
* Boston, MA 02110-1301 USA
*
* Authored by: torikulhabib <torik.habib@Gmail.com>
*/

let result = true;
let interruptDownloads = true;
let defaultPort = "2021";
let PortSet = "";
let CustomPort = false;
let HostDownloader = "http://127.0.0.1:";

load_conf ();
alwawscheck ();
function alwawscheck () {
    var xmlrequest = new XMLHttpRequest ();
    xmlrequest.open ("GET", get_host (), true);
    xmlrequest.setRequestHeader ("Content-type", "application/x-www-form-urlencoded");
    xmlrequest.send ("");
    xmlrequest.onreadystatechange = function () {
        if (xmlrequest.statusText == "OK") {
            result = false;
        } else {
            result = true;
        }
        icon_load ();
    }
}

function icon_load () {
    if (interruptDownloads && !result) {
        browser.browserAction.setIcon({path: "./icons/icon_32.png"});
    } else {
        browser.browserAction.setIcon({path: "./icons/icon_disabled_32.png"});
    }
}

browser.downloads.onCreated.addListener (function (downloadItem) {
    alwawscheck ();
    if (!interruptDownloads || result) {
        return;
    }
    setTimeout (()=> {
        browser.downloads.cancel (downloadItem.id);
        browser.downloads.erase({ id: downloadItem.id });
    });
    SendToOniDM (downloadItem);
});

function SendToOniDM (downloadItem) {
    var content = "link:${finalUrl},filename:${filename},referrer:${referrer},mimetype:${mime},filesize:${filesize},resumable:${canResume},";
    var urlfinal = content.replace ("${finalUrl}", (downloadItem['finalUrl']||downloadItem['url']));
    var filename = urlfinal.replace ("${filename}", baseName(downloadItem['filename']));
    var referrer = filename.replace ("${referrer}", downloadItem['referrer']);
    var mime = referrer.replace ("${mime}", downloadItem['mime']);
    var filseize = mime.replace ("${filesize}", downloadItem['fileSize']);
    var resume = filseize.replace ("${canResume}", downloadItem['canResume']);
    console.log (resume);
    var xmlrequest = new XMLHttpRequest ();
    xmlrequest.open ("POST", get_host (), true);
    xmlrequest.setRequestHeader ("Content-type", "application/x-www-form-urlencoded");
    xmlrequest.send (resume);
}

function baseName (str) {
    var base = new String(str).substring(str.lastIndexOf('/') + 1); 
    if (base.lastIndexOf(".") != -1) {
        base = base.substring(0, base.length);
    }
    return base;
}

async function StorageGetter (key) {
    return new Promise (resolve => {
        browser.storage.local.get (key, (obj)=> {
            return resolve(obj[key] || '');
        })
    });
}

async function load_conf () {
    alwawscheck ();
    interruptDownloads = await StorageGetter ('interrupt-download');
    CustomPort = await StorageGetter ('port-custom');
    PortSet = await StorageGetter ('port-input');
    icon_load ();
}

async function setPortCustom (interrupt) {
    await SavetoStorage('port-custom', interrupt);
}

async function setPortInput (interrupt) {
    if (CustomPort) {
        await SavetoStorage('port-input', interrupt);
    }
}

async function setInterruptDownload (interrupt) {
    await SavetoStorage('interrupt-download', interrupt);
}

async function SavetoStorage(key, value) {
    return new Promise(resolve => {
        browser.storage.local.set({[key]: value}, resolve);
    });
}

browser.commands.onCommand.addListener(function (command) {
    if (command == "intrupt-toggle") {
        setInterruptDownload (!interruptDownloads);
        browser.runtime.sendMessage({ extensionId: command, message: !interruptDownloads});
        load_conf ();
    } else if (command == "custom-toggle") {
        setPortCustom (!CustomPort);
        browser.runtime.sendMessage({ extensionId: command, message:  !CustomPort});
        load_conf ();
    }
});

browser.runtime.onMessage.addListener((message, callback) => {
    if (message.extensionId == "interuptopen") {
        browser.runtime.sendMessage({ message: interruptDownloads, extensionId: "popintrup" });
        alwawscheck ();
    } else if (message.extensionId == "customopen") {
        browser.runtime.sendMessage({ message: CustomPort, extensionId: "popcust" });
        alwawscheck ();
    } else if (message.extensionId == "portopen") {
        browser.runtime.sendMessage({ message: PortSet, extensionId: "popport" });
        alwawscheck ();
    } else if (message.extensionId == "interuptchecked") {
        setInterruptDownload (message.message);
        load_conf ();
    } else if (message.extensionId == "customchecked") {
        setPortCustom (message.message);
        load_conf ();
    } else if (message.extensionId == "portval") {
        setPortInput (message.message);
        load_conf ();
    }
});

function get_host () {
    if (CustomPort) {
        return HostDownloader + PortSet;
    } else {
        return HostDownloader + defaultPort;
    }
}