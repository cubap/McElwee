// TODO: custom elements when behaviors are needed.
// class McView extends HTMLDivElement {
//     constructor() {
//         super()
//     }
// }
// customElements.define("mc-view",McView,{extends:"div"})
var mc = {}
const CFG = window.McElweeConfig
const DEFAULT_LIST_ID = CFG.DEFAULT_LIST_ID

mc.focusObject = document.getElementById("mc-view")

mc.focusOn = function(id) {
    mc.focusObject.setAttribute('mc-object', CFG.normalizeId(id))
}
function readCache(id) {
    try {
        return JSON.parse(localStorage.getItem(CFG.normalizeId(id)))
    } catch (err) {
        return null
    }
}

function writeCache(obj) {
    const id = CFG.normalizeId(obj && obj["@id"])
    if (!id) return obj
    localStorage.setItem(id, JSON.stringify(obj))
    if (String(obj["@type"] || "").indexOf("ItemList") > -1) {
        localStorage.setItem("CURRENT_LIST_ID", id)
    }
    return obj
}

/**
 * Read one entity.
 *
 * RERUM IRIs are fetched live so the exhibit always shows the current version of a
 * record; the copy seeded by mcdata.js is the fallback when the store or the network is
 * unavailable. Short local ids (p001, l001, ...) only ever exist in localStorage, so
 * they are read straight from the cache.
 */
async function get(url) {
    const id = CFG.normalizeId(url)
    if (CFG.isRerumId(id)) {
        try {
            const response = await fetch(id)
            if (!response.ok) {
                throw new Error(`RERUM answered ${response.status} for ${id}`)
            }
            return writeCache(await response.json())
        } catch (err) {
            console.warn(`Using the bundled copy of ${id}. ${err.message}`)
        }
    }
    const cached = readCache(id)
    if (!cached) {
        return Promise.reject(new Error(`No data available for ${id}.`))
    }
    return cached
}

async function expand(obj) {
    let toRender = {}
    let findId = obj["@id"]
    let annos = await findByTargetId(findId)
        // TODO: attach evidence to each property value
        // add each value in a predictable way
        // type properties for possible rendering?
    for (let i = 0; i < annos.length; i++) {
        let body = annos[i].body
        if (!Array.isArray(body)) {
            body = [body]
        }
        Leaf: for (let j = 0; j < body.length; j++) {
            if (body[j].evidence) {
                let evId = (typeof body[j].evidence === "object") ? body[j].evidence["@id"] : body[j].evidence
                obj.evidence = await get(evId)
            } else {
                let val = body[j]
                let k = Object.keys(val)[0]
                if (!val.source) {
                    let aVal = val[k].value || val[k]
                    val[k] = {
                        value: aVal,
                        source: annos[i]["@id"]
                    }
                }
                if (obj[k] !== undefined && annos[i].__rerum && annos[i].__rerum.history.next.length) {
                    // this is not the most recent available
                    // TODO: maybe check generator, etc.
                    continue Leaf
                } else {
                    obj = Object.assign(obj, val)
                }
            }
        }
    }
    return obj
}

async function findByTargetId(id) {
    let everything = Object.keys(localStorage).map(k => (k && k.length === 4) && JSON.parse(localStorage.getItem(k)))
    let targets = CFG.idVariants(id)
    let canonical = CFG.normalizeId(id)
    let responses = await Promise.all(targets.map(target => fetch(CFG.QUERY_URL, {
        method: "POST",
        body: JSON.stringify({ target: target }),
        headers: {
            "Content-Type": "application/json"
        }
    }).then(response => response.ok ? response.json() : []).catch(() => [])))
    let matches = []
    let seen = {}
    responses.flat().forEach(match => {
        if (!match || !match["@id"] || seen[match["@id"]]) return
        seen[match["@id"]] = true
        matches.push(match)
    })
    let local_matches = everything.filter(o => o && CFG.normalizeId(o.target) === canonical)
    return local_matches.concat(matches)
}

var template = {}

template.evidence = function(obj) {
    try {
        let evidenceId = CFG.normalizeId((typeof obj.evidence === "object") ? obj.evidence["@id"] : obj.evidence)
        return `<a class="mc-evidence" href="${evidenceId}" target="_blank">${obj.evidence.label || "View evidence"}</a>`
    } catch (err) {
        return null
    }
}

template.fullName = function(obj) {
    try {
        return `<div class="mc-name">${obj.familyName&&obj.familyName.value||obj.familyName||"[ unknown ]"}, ${obj.givenName&&obj.givenName.value||obj.givenName||""}</div>`
    } catch (err) {
        return null
    }
}

template.prop = function(obj, prop, altLabel) {
    try {
        return `<span class="${("mc-"+prop).trim().replace(/\s+/g,"-").replace(/:/g,"-").replace(/(mc-)+/g,"mc-").normalize("NFC").toLowerCase()}">${altLabel || prop}: ${obj[prop].value || obj[prop] || "[ undefined ]"}</span>`
    } catch (err) {
        return null
    }
}

template.gender = function(obj) {
    try {
        let gender = ((obj.gender && obj.gender.value) || obj.gender)
        if (!gender) {
            throw "No gender."
        }
        return `<span class="mc-gender">${ gender }</span>`
    } catch (err) {
        return null
    }
}

template.depiction = async function(obj) {
    try {
        let depiction = ((obj.depiction && obj.depiction.value) || obj.depiction)
        if (!depiction) { throw "No depiction." }
        // return `<img alt="${obj.label} depiction" class="mc-depiction" onclick="this.classList.toggle('clicked')" src="${depiction}">`
        // TODO: figure out how to check for the image without returning a Promise
        let loaded = () => new Promise((resolve, reject) => {
            let img = new Image()
            img.onload = () => resolve()
            img.onerror = reject
            img.src = depiction
        })
        let tmp = await loaded().then(() => `<img alt="${obj.label} depiction" class="mc-depiction" onclick="this.classList.toggle('clicked')" src="${depiction}">`)
        return tmp
    } catch (err) {
        return null
    }
}

template.JSON = function(obj) {
    try {
        return `${JSON.stringify(obj, null, 4)}`
    } catch (err) {
        return null
    }
}

template.location = async function() {
    // let cemetery = await checkForUpdates("l001")
    let cemetery = await expand(await get("l001"))
    if (!cemetery) {
        return null
    }
    let tmpl = `<h2>${cemetery.name&&cemetery.name.value||cemetery.name||"[ unlabeled ]"}</h2>`
    let description = (cemetery.description && cemetery.description.value) || cemetery.description
    if (description) {
        tmpl += `<p class="mc-location-description">${description}</p>`
    }
    if (cemetery.seeAlso) {
        tmpl += `<a href="${cemetery.seeAlso&&cemetery.seeAlso.value||cemetery.seeAlso||null}" target="_blank" class="mc-see-also">${cemetery.seeAlso&&cemetery.seeAlso.value||cemetery.seeAlso}</a>`
    }
    return tmpl
}

/**
 * The only relevant list is the list of residents.
 * https://schema.org/ItemList
 */
template.list = function(ItemList) {
    if (typeof ItemList.itemListElement === "string") {
        get(ItemList.itemListElement).then(function(ls) {
            ItemList.itemListElement = ls
            return template.list(ItemList)
        })
    }
    let ul = `<p>${ItemList.name||"[ unlabeled ]"}</p>
    <ul class="mc-list">`
    for (var item of ItemList.itemListElement) {
        // RERUM hands back http:// IRIs inside the list; normalizeId keeps the link
        // from being blocked as mixed content on the https site.
        let itemId = CFG.normalizeId(item["@id"])
        ul += `<li><a href="#" onclick="mc.focusOn('${itemId}')">${item.name || "unrecorded"}</a></li>`
    }
    ul += `</ul>`
    return ul
}

template.byObjectType = async function(obj) {
    let templateFunction = function() {}
    let type = (Array.isArray(obj["@type"])) ? obj["@type"][0] : obj["@type"]
    switch (type) {
        case "Person":
            templateFunction = await template.person
            break
        case "ItemList":
            templateFunction = await template.list
            break
        case "Location":
            templateFunction = await template.location
            break
        case "Event":
            templateFunction = await template.event
            break
        default:
            return null
    }
    setClass(type)
    return templateFunction(obj)
}

template.person = async function(obj) {
    setClass("Person")
    let elem = `<h3>${(obj.name && obj.name.value) || obj.name || "name unavailable"}</h3>`
    let tmp = [
        template.fullName(obj),
        template.gender(obj),
        template.prop(obj, "birthDate", "Birth Date"),
        template.prop(obj, "deathDate", "Death Date"),
        template.evidence(obj),
        template.prop(obj, "description", " "),
        await template.depiction(obj)
    ]
    // Data entry lives in the local-only /entry/ subsite now; the published exhibit
    // renders records and never edits them.
    elem += tmp.join("\n")
    return elem
}

async function renderElement(elem, tmp) {
    // Await first so a rejected render leaves existing (static fallback) content intact.
    let html = await tmp
    while (elem.firstChild) {
        elem.removeChild(elem.firstChild)
    }
    if (html) {
        elem.innerHTML = html
    }
}

function setClass(className) {
    mc.focusObject.classList.remove("Event", "Person", "Location", "ItemList", "Thing")
    mc.focusObject.classList.add(className)
}

async function observerCallback(mutationsList) {
    for (var mutation of mutationsList) {
        if (mutation.attributeName === "mc-object") {
            let id = CFG.normalizeId(mc.focusObject.getAttribute("mc-object"))
            let data = await expand(await get(id))
            renderElement(mc.focusObject, template.byObjectType(data))
            renderElement(document.getElementById("obj-viewer"), template.JSON(data))
        }
    }
}

mc.renderObserver = new MutationObserver(observerCallback)
mc.renderObserver.observe(mc.focusObject, {
    attributes: true
})


// load defaulty bits
renderElement(document.getElementById("mc-location"), template.location())
mc.focusObject.setAttribute("mc-object", CFG.normalizeId(localStorage.getItem("CURRENT_LIST_ID")) || DEFAULT_LIST_ID)
