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
let InterruptDownloads = true;
let PortSet = "";
let CustomPort = false;
var DownloadVideo = false;

load_conf ();
setInterval (function () {
    fetch (get_host (), {requiredStatus: 'ok'}).then(function() {
        ResponGdm = false;
    }).catch(function() {
        ResponGdm = true;
    });
    icon_load ();
}, 2000);

icon_load = function () {
    if (InterruptDownloads && !ResponGdm) {
        browser.action.setIcon({path: "./icons/icon_32.png"});
    } else {
        browser.action.setIcon({path: "./icons/icon_disabled_32.png"});
    }
}

async function RunScript (tabId, callback) {
    let existid = false;
    let scripts = await browser.scripting.getRegisteredContentScripts();
    for (let scrid of scripts.map((script) => script.id)) {
        existid = true;
    }
    callback (existid);
}

async function StopScript (tabId) {
    let scripts = await browser.scripting.getRegisteredContentScripts();
    for (let scrid of scripts.map((script) => script.id)) {
        await browser.scripting.unregisterContentScripts ({ids: [scrid],}).catch(function() {});
    }
}

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab)=> {
    if (DownloadVideo) {
        if (changeInfo.status == 'loading') {
            RunScript (tabId, function (existid) {
                if (!existid) {
                    browser.scripting.registerContentScripts([{id: `${tabId}`, allFrames: false, matches: ['<all_urls>'], js: ['content-script.js'], css: ['content-script.css']}]);
                }
            });
            browser.webRequest.onResponseStarted.removeListener (WebContent);
            browser.tabs.sendMessage(tabId, {message: 'gdmclean'}).then (function () {}).catch(function() {});
            browser.webRequest.onResponseStarted.addListener (WebContent, {urls: ['<all_urls>']}, ['responseHeaders']);
        }
    } else {
        StopScript (tabId);
    }
});

function WebContent (content) {
    if (content.tabId === -1) {
        return;
    }
    let length = content.responseHeaders.filter (cont => cont.name.toUpperCase () === 'CONTENT-LENGTH').map (lcont => lcont.value).shift ();
    if (length > 1) {
        let gdmtype = content.responseHeaders.filter (cont => cont.name.toUpperCase () === 'CONTENT-TYPE').map (lcont => lcont.value).shift ();
        if (gdmtype != 'undefined') {
            if (`${gdmtype}`.startsWith ('video')) {
                if (length > 10000000) {
                    browser.tabs.sendMessage(content.tabId, {message: 'gdmvideo', urls: content.url, size: length, mimetype: gdmtype}).then (function () {}).catch(function() {});
                }
            } else if (`${gdmtype}`.startsWith ('audio')) {
                browser.tabs.sendMessage(content.tabId, {message: 'gdmaudio', urls: content.url, size: length, mimetype: gdmtype}).then (function () {}).catch(function() {});
            }
        }
    }
}

browser.downloads.onCreated.addListener (function (downloadItem) {
    if (!InterruptDownloads || ResponGdm) {
        return;
    }
    if (downloadItem['url'].includes ("blob:")) {
        return;
    }
    queueMicrotask (()=> {
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
    gdmurl += downloadItem['url'];
    gdmurl += ',';
    gdmurl += 'filename:';
    gdmurl += baseName (downloadItem['filename']);
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
    InterruptDownloads = await StorageGetter ('interrupt-download');
    CustomPort = await StorageGetter ('port-custom');
    DownloadVideo = await StorageGetter ('video-download');
    PortSet = await StorageGetter ('port-input');
    icon_load ();
}

async function setPortCustom (interrupt) {
    await SavetoStorage('port-custom', interrupt);
}

async function setVideoMenu (download) {
    await SavetoStorage('video-download', download);
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
        setInterruptDownload (!InterruptDownloads);
        browser.runtime.sendMessage({ extensionId: command, message: !InterruptDownloads}).catch(function() {});
        load_conf ();
    } else if (command == "avideo-toggle") {
        setVideoMenu (!DownloadVideo);
        browser.runtime.sendMessage({ extensionId: command, message:  !DownloadVideo}).catch(function() {});
        load_conf ();
    }
});

browser.runtime.onMessage.addListener((request, sender, callback) => {
    if (request.extensionId == "interuptopen") {
        browser.runtime.sendMessage({ message: InterruptDownloads, extensionId: "popintrup" }).catch(function() {});
    } else if (request.extensionId == "customopen") {
        browser.runtime.sendMessage({ message: CustomPort, extensionId: "popcust" }).catch(function() {});
    } else if (request.extensionId == "portopen") {
        browser.runtime.sendMessage({ message: PortSet, extensionId: "popport" }).catch(function() {});
    } else if (request.extensionId == "videoopen") {
        browser.runtime.sendMessage({ message: DownloadVideo, extensionId: "popvideo" }).catch(function() {});
    } else if (request.extensionId == "videochecked") {
        setVideoMenu (request.message);
        load_conf ();
    } else if (request.extensionId == "interuptchecked") {
        setInterruptDownload (request.message);
        load_conf ();
    } else if (request.extensionId == "customchecked") {
        setPortCustom (request.message);
        load_conf ();
    } else if (request.extensionId == "portval") {
        setPortInput (request.message);
        load_conf ();
    } else if (request.extensionId == "gdmurl") {
        if (!InterruptDownloads || ResponGdm) {
            downloadfirefox (request.message);
            return;
        }
        fetch (get_host (), { method: 'post', body: request.message }).then (function (r) { return r.text (); }).catch (function () {});
    }
});

async function downloadfirefox (urls) {
    let url = urls.substring (5, urls.lastIndexOf(",filename:"));
    await browser.downloads.download({url: url});
}

get_host = function () {
    if (CustomPort) {
        return `http://127.0.0.1:${PortSet}`;
    } else {
        return "http://127.0.0.1:2021";
    }
}