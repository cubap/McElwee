// TODO: custom elements when behaviors are needed.
// class McView extends HTMLDivElement {
//     constructor() {
//         super()
//     }
// }
// customElements.define("mc-view",McView,{extends:"div"})
var mc = {}
const DEFAULT_LIST_ID = "http://devstore.rerum.io/v1/id/5bc8089ce4b09992fca2222c"
const BASE_ID = "http://devstore.rerum.io/v1"
const CREATE_URL = "http://tinydev.rerum.io/app/create"
const UPDATE_URL = "http://tinydev.rerum.io/app/update"

mc.focusObject = document.getElementById("mc-view")

mc.focusOn = function(id) {
    mc.focusObject.setAttribute('mc-object', id)
}
async function checkForUpdates(id, isFresh) {
    let obj = JSON.parse(localStorage.getItem(id))
    try {
        if (id.startsWith(BASE_ID)) {
            if (!isFresh) {
                let response = await fetch(id)
                obj = await response.json()
                    // TODO: handle failure
            }
            if (obj.__rerum.history.next.length > 0) {
                obj = await fetch(obj.__rerum.history.next[0]).then(response => response.json())
                    // TODO: only the first is selected and that's not necessarily right.
                localStorage.removeItem(id)
                localStorage.setItem(obj["@id"], JSON.stringify(obj))
                if (obj["@type"].indexOf("ItemList") > -1) {
                    localStorage.setItem("CURRENT_LIST_ID", obj["@id"])
                }
                checkForUpdates(obj["@id"], true)
            }
        }
    } catch (err) {
        // It's not important what happened; let the finally remove the button
    } finally {
        for (elem of document.getElementsByClassName("mc-update-button")) {
            if (elem.getAttribute("mc-update-target") === id) {
                elem.remove()
            }
        }
        if (obj["@type"].indexOf("ItemList") > -1) {
            localStorage.setItem("CURRENT_LIST_ID", obj["@id"])
        }
        localStorage.setItem(obj["@id"], JSON.stringify(obj))
        return obj
    }
}

async function get(url, exact) {
    let obj
    try {
        obj = JSON.parse(localStorage.getItem(url))
        if (obj['@id'].startsWith(BASE_ID)) {
            // TODO: technically, this won't check for updates...
            let btn = document.createElement("span")
            btn.innerHTML = `<button role="button" onclick="checkForUpdates('${obj['@id']}')">Check for Updates on ${obj.name||obj.label}</button>`
            btn.setAttribute("mc-update-target", obj['@id'])
            btn.classList.add("mc-update-button")
            let msg = document.getElementById("flash-message")
            msg.after(btn)
        }
        return obj
    } catch (err) {
        // nothing useful in localStorage
        const response = await fetch(url)
        const obj = await response.json()
        localStorage.setItem(obj["@id"], JSON.stringify(obj))
        return response.ok ? obj : Promise.reject(obj)
    }
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
    let local_matches, matches
    let obj = {
        target: id
    }
    matches = await fetch("http://tinydev.rerum.io/app/query", {
        method: "POST",
        body: JSON.stringify(obj),
        headers: {
            "Content-Type": "application/json"
        }
    }).then(response => response.json())
    local_matches = everything.filter(o => o.target === id)
    return local_matches.concat(matches)
}

var template = {}

template.evidence = function(obj) {
    try {
        return `<a class="mc-evidence" href="${(typeof obj.evidence === "object") ? obj.evidence["@id"] : obj.evidence}" target="_blank">${obj.evidence.label || "View evidence"}</a>`
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
        ul += `<li><a href="#" onclick="mc.focusOn('${item['@id']}')">${item.name || "unrecorded"}</a></li>`
    }
    ul += `</ul>
    <button type="role" onclick="renderElement(mc.focusObject,template.person({}))">+</button>`
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

template.person = async function(obj, hideEditForm) {
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
    elem += tmp.join("\n")
    if (!hideEditForm) {
        let pForm = document.getElementById("mc-edit-form")
        pForm.innerHTML = template.personForm(obj)
        let elements = [].concat.apply([], pForm.getElementsByTagName("input"))
        elements = Array.prototype.concat.apply(elements, pForm.getElementsByTagName("textarea"))
        for (var el of elements) {
            el.onchange = function(event) {
                let prop = event.target.getAttribute("mc-key")
                obj[prop] = event.target.value
                renderElement(mc.focusObject, template.person(obj, true))
                renderElement(document.getElementById("obj-viewer"), template.JSON(obj))
                event.target.$isDirty = true
                document.getElementById("mc-edit-form").getElementsByTagName("button")[0].style = "display:block;"
                event.stopPropagation()
            }
            el.addEventListener('input', el.onchange)
        }
    }
    return elem
}

template.personForm = function(person) {
    return `<form class="mc-person-edit" onsubmit="${ person["@id"] && "editPerson(event)" || "createPerson(event)" }">
    <input type="hidden" mc-key="@type" value="Person" id="mc-type" >
    <input type="hidden" mc-key="@context" value="http://schema.org" id="mc-context" >
    <input type="hidden" mc-key="@id" value="${person["@id"]}" id="mc-at-id" >
    <input id="mc-evidence" mc-key="evidence" type="hidden" class="mc-data-entry" value="http://devstore.rerum.io/v1/id/5b76fc0de4b09992fca21e68" >
    <label for="mc-label">Full Name: 
        <input id="mc-label" type="text" mc-key="name" class="mc-data-entry" placeholder="full name" value="${ (person.name&&person.name.value) || (person.name) || "" }" >
    </label>
    <label for="mc-birth-date">Birth Date: 
        <input id="mc-birth-date" mc-key="birthDate" oa-source="${ person.birthDate&&person.birthDate.source }" type="date" class="mc-data-entry" placeholder="YYYY-MM-DD" value="${ person.birthDate&&person.birthDate.value || "" }" >
    </label>
    <label for="mc-death-date">Death Date: 
        <input id="mc-death-date" mc-key="deathDate" oa-source="${ person.deathDate&&person.deathDate.source }" type="date" class="mc-data-entry" value="${ person.deathDate&&person.deathDate.value || "" }" >
    </label>
    <label for="mc-given-name">Given Name: 
        <input id="mc-given-name" mc-key="givenName" oa-source="${ person.givenName&&person.givenName.source }" type="text" class="mc-data-entry" value="${ person.givenName&&person.givenName.value || "" }" >
    </label>
    <label for="mc-family-name">Family Name: 
        <input id="mc-family-name" mc-key="familyName" oa-source="${ person.familyName&&person.familyName.source }" type="text" class="mc-data-entry" placeholder="family name" value="${ person.familyName&&person.familyName.value || "" }" >
    </label>
    <label for="mc-maiden-name">Maiden Name: 
        <input id="mc-maiden-name" mc-key="alternateName" oa-source="${ person.alternateName&&person.alternateName.source }" type="text" class="mc-data-entry" placeholder="former name" value="${ person.alternateName&&person.alternateName.value || "" }" >
    </label>
    <label for="mc-depiction">Depiction: 
        <input id="mc-depiction" mc-key="depiction" oa-source="${ person.depiction&&person.depiction.source }" type="text" class="mc-data-entry" placeholder="headstone depiction" value="${ person.depiction&&person.depiction.value || "" }" >
    </label>
    <label for="mc-transcription">Catalog Entry: 
        <textarea id="mc-transcription" mc-key="description" oa-source="${ person.description&&person.description.source }" type="text" class="mc-data-entry" >${ person.description&&person.description.value || "" }</textarea>
    </label>
    <button type="submit" style="display:${person.$isDirty?"block":"none"};">${person["@id"]?"Update":"Create"}</button>
    </form>`
}

async function renderElement(elem, tmp) {
    while (elem.firstChild) {
        elem.removeChild(elem.firstChild)
    }
    if (tmp) {
        elem.innerHTML = await tmp
    }
}

function setClass(className) {
    mc.focusObject.classList.remove("Event", "Person", "Location", "ItemList", "Thing")
    mc.focusObject.classList.add(className)
}

async function observerCallback(mutationsList) {
    for (var mutation of mutationsList) {
        if (mutation.attributeName === "mc-object") {
            let id = mc.focusObject.getAttribute("mc-object")
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
mc.focusObject.setAttribute("mc-object", localStorage.getItem("CURRENT_LIST_ID") || DEFAULT_LIST_ID)

async function editPerson(event) {
    event.preventDefault()
    let params = [];

    let dirtyFields = []
    for (let elem of document.getElementsByClassName("mc-data-entry")) {
        if (elem.$isDirty) {
            dirtyFields.push(elem)
        }
    }

    for (elem of dirtyFields) {
        const annoKey = elem.getAttribute("mc-key")
        let source = elem.getAttribute("oa-source")
        if (source === "undefined") {
            source = false
        }
        let config = {
            url: source ? UPDATE_URL : CREATE_URL,
            method: source ? "PUT" : "POST",
            body: {
                "@context": "http://www.w3.org/ns/anno.jsonld",
                "@type": "Annotation",
                "motivation": "describing",
                "target": document.getElementById("mc-at-id").value,
                "body": {}
            }
        }
        config.body.body[annoKey] = {
            value: elem.value,
            evidence: document.getElementById("mc-evidence").value
        }
        if (source) {
            config.body["@id"] = elem.getAttribute("oa-source")
        }
        fetch(config.url, {
                method: config.method,
                headers: {
                    "Content-Type": "application/json; charset=utf-8"
                },
                body: JSON.stringify(config.body)
            }).catch(error => console.error('Error:', error))
            .then(response => response.json())
            .then(function(newState) {
                localStorage.setItem(newState["@id"], JSON.stringify(newState.new_obj_state))
                mc.focusOn(newState.new_obj_state.target)
            })
    }
}

async function createPerson(event) {
    event.preventDefault()
    let labelElem = document.getElementById("mc-label")
    let contextElem = document.getElementById("mc-context")
    let typeElem = document.getElementById("mc-type")
    let newPerson = {}
    newPerson[contextElem.getAttribute("mc-key")] = contextElem.value
    newPerson[labelElem.getAttribute("mc-key")] = labelElem.value
    newPerson[typeElem.getAttribute("mc-key")] = typeElem.value
    const res = await fetch(CREATE_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json; charset=utf-8"
            },
            body: JSON.stringify(newPerson)
        })
        .then(response => response.json())
    document.getElementById("mc-at-id").value = res.new_obj_state["@id"]
    const listID = localStorage.getItem("CURRENT_LIST_ID") || DEFAULT_LIST_ID
    let list = await get(listID)
    newPerson["@id"] = res.new_obj_state["@id"]
        // the @context is redundant with the container here
    delete newPerson[contextElem.getAttribute("mc-key")]
    list.itemListElement.push(newPerson)
    list.numberOfItems = list.itemListElement.length
    try {
        list = await fetch(UPDATE_URL, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json; charset=utf-8"
                },
                body: JSON.stringify(list)
            })
            .then(response => response.json().new_obj_state)
            .catch(err => Promise.reject(err))
    } catch (err) {}
    localStorage.setItem(listID, JSON.stringify(list))
    localStorage.setItem("CURRENT_LIST_ID", listID)
    return editPerson(event)
}