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

let ResponGdm = true;
let interruptDownloads = true;
let PortSet = "";
let CustomPort = false;

load_conf ();
browser.tabs.onHighlighted.addListener(gdmactive);
function gdmactive () {
    fetch (get_host (), {requiredStatus: 'ok'}).then (function () {
        ResponGdm = false;
    }).catch(function () {
        ResponGdm = true;
    });
    icon_load ();
}

function icon_load () {
    if (interruptDownloads && !ResponGdm) {
        browser.browserAction.setIcon({path: "./icons/icon_32.png"});
    } else {
        browser.browserAction.setIcon({path: "./icons/icon_disabled_32.png"});
    }
}

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab)=> {
    if (tab.url.includes ('youtube')) {
        browser.tabs.sendMessage(tabId, {message: 'gdmclean'}).then (function () {}).catch(function() {});
    }
    if (changeInfo.status == 'loading') {
        browser.webRequest.onResponseStarted.removeListener (WebContent);
        browser.tabs.sendMessage(tabId, {message: 'gdmclean'}).then (function () {}).catch(function() {});
    }
    browser.webRequest.onResponseStarted.addListener (WebContent, {urls: ['<all_urls>']}, ['responseHeaders']);
});

function WebContent (content) {
    if (content.tabId === -1) {
        return;
    }
    const length = content.responseHeaders.filter (cont => cont.name.toUpperCase () === 'CONTENT-LENGTH').map (lcont => lcont.value).shift ();
    if (length > 1) {
        let gdmtype = content.responseHeaders.filter (cont => cont.name.toUpperCase () === 'CONTENT-TYPE')[0].value;
        if (gdmtype.startsWith ('video')) {
            browser.tabs.sendMessage(content.tabId, {message: 'gdmvideo', urls: content.url, size: length, mimetype: gdmtype}).then (function () {}).catch(function() {});
        } else if (gdmtype.startsWith ('audio')) {
            browser.tabs.sendMessage(content.tabId, {message: 'gdmaudio', urls: content.url, size: length, mimetype: gdmtype}).then (function () {}).catch(function() {});
        }
    }
}

browser.downloads.onCreated.addListener (function (downloadItem) {
    if (!interruptDownloads || ResponGdm) {
        return;
    }
    setTimeout (()=> {
        browser.downloads.cancel (downloadItem.id);
        browser.downloads.erase ({ id: downloadItem.id });
    });
    SendToOniDM (downloadItem);
});

async function SendToOniDM (downloadItem) {
    fetch (get_host (), { method: 'post', body: get_downloader (downloadItem) }).then (function (r) { return r.text (); }).catch (function () {});
}

function get_downloader (downloadItem) {
    let gdmurl = 'link:';
    gdmurl += (downloadItem['finalUrl']||downloadItem['url']);
    gdmurl += ',';
    gdmurl += 'filename:';
    gdmurl += downloadItem['filename'];
    gdmurl += ',';
    gdmurl += 'referrer:';
    gdmurl += downloadItem['referrer'];
    gdmurl += ',';
    gdmurl += 'mimetype:';
    gdmurl += downloadItem['mime'];
    gdmurl += ',';
    gdmurl += 'filesize:';
    gdmurl += downloadItem['fileSize'];
    gdmurl += ',';
    gdmurl += 'resumable:';
    gdmurl += downloadItem['canResume'];
    gdmurl += ',';
    return gdmurl;
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
        browser.runtime.sendMessage({ extensionId: command, message: !interruptDownloads}).catch(function() {});
        load_conf ();
    } else if (command == "custom-toggle") {
        setPortCustom (!CustomPort);
        browser.runtime.sendMessage({ extensionId: command, message:  !CustomPort}).catch(function() {});
        load_conf ();
    }
});

browser.runtime.onMessage.addListener((request, callback) => {
    if (request.extensionId == "interuptopen") {
        browser.runtime.sendMessage({ message: interruptDownloads, extensionId: "popintrup" }).catch(function() {});
    } else if (request.extensionId == "customopen") {
        browser.runtime.sendMessage({ message: CustomPort, extensionId: "popcust" }).catch(function() {});
    } else if (request.extensionId == "portopen") {
        browser.runtime.sendMessage({ message: PortSet, extensionId: "popport" }).catch(function() {});
    } else if (request.extensionId == "interuptchecked") {
        setInterruptDownload (request.message);
        gdmactive ();
        load_conf ();
    } else if (request.extensionId == "customchecked") {
        setPortCustom (request.message);
        load_conf ();
    } else if (request.extensionId == "portval") {
        setPortInput (request.message);
        load_conf ();
    } else if (request.extensionId == "gdmurl") {
        if (!interruptDownloads || ResponGdm) {
            return;
        }
        fetch (get_host (), { method: 'post', body: request.message }).then (function (r) { return r.text (); }).catch (function () {});
    }
});

function get_host () {
    if (CustomPort) {
        return "http://127.0.0.1:" + PortSet;
    } else {
        return "http://127.0.0.1:2021";
    }
}