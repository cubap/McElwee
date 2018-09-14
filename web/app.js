// TODO: custom elements when behaviors are needed.
// class McView extends HTMLDivElement {
//     constructor() {
//         super()
//     }
// }
// customElements.define("mc-view",McView,{extends:"div"})
var mc = {}
const DEFAULT_LIST_ID = "li01"
const BASE_ID = "http://devstore.rerum.io/v1"
const CREATE_URL = "http://tinydev.rerum.io/app/create"
const UPDATE_URL = "http://tinydev.rerum.io/app/update"

mc.focusObject = document.getElementById("mc-view")

mc.focusOn = function (id) {
    mc.focusObject.setAttribute('mc-object', id)
}
async function checkForUpdates(id, isFresh) {
    let obj = localStorage.getItem(id)
    try {      
        if (id.startsWith(BASE_ID)) {
            if (!isFresh) { 
                let response = await fetch(id)
                obj = await response.json()
            }
            if (obj.__rerum.history.next.length > 0){
                obj = await fetch(obj.__rerum.history.next[0]).then(response=>response.json()).then(json=>json.new_obj_state)
                // TODO: only the first is selected and that's not necessarily right.
                localStorage.removeItem("id")
                localStorage.setItem(obj["@id"],obj)
                if (obj["@type"]==="List") {
                    localStorage.setItem("CURRENT_LIST_ID",obj["@id"])
                }
                return checkForUpdates(obj["@id"],true)
            }
            return obj
        }
    } catch (err) {
        // It's not important what happened; let the finally remove the button
    } finally {
        for(elem of document.getElementsByClassName("mc-update-button")){
            if (elem.getAttribute("mc-update-target") ===id) {
                elem.parentElement.remove()
            }
        }
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
            btn.innerHTML = `<button role="button" onclick="checkForUpdates('${obj['@id']}')">Check for Updates on ${obj.label}</button>`
            btn.setAttribute("mc-update-target",obj['@id'])
            btn.classList.add("mc-update-button")
            let msg = document.getElementById("flash-message")
            msg.after(btn)
        }
        return obj
    } catch (err) {
        // nothing useful in localStorage
        const response = await fetch(url)
        const json = await response.json()
        return response.ok ? json : Promise.reject(json)
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
                if (!val["mc:source"]) {
                    let aVal = val[k].value || val[k]
                    val[k] = {
                        value: aVal,
                        "mc:source": annos[i]["@id"]
                    }
                }
                if (obj[k] !== undefined && annos[i].__rerum&&annos[i].__rerum.history.next.length) {
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

template.evidence = function (obj) {
    try {
        return `<a class="mc-evidence" href="${(typeof obj.evidence === "object") ? obj.evidence["@id"] : obj.evidence}" target="_blank">${obj.evidence.label || "View evidence"}</a>`
    } catch (err) {
        return null
    }
}

template.fullName = function (obj) {
    try {
        return `<div class="mc-name">${obj['mc:familyName']&&obj['mc:familyName'].value||obj['mc:familyName']||"[ unknown ]"}, ${obj['mc:givenName']&&obj['mc:givenName'].value||obj['mc:givenName']||""}</div>`
    } catch (err) {
        return null
    }
}

template.prop = function (obj, prop, altLabel) {
    try {
        return `<span class="mc-${prop.trim().replace(/\s+/g,"-").replace(/:/g,"-").replace(/(mc-)+/g,"mc-").normalize("NFC").toLowerCase()}">${altLabel || prop}: ${obj[prop].value || "[ undefined ]"}</span>`
    } catch (err) {
        return null
    }
}

template.gender = function (obj) {
    try {
        let gender = ((obj.gender && obj.gender.value) || obj.gender)
        if (!gender) { throw "No gender." }
        return `<span class="mc-gender">${ gender }</span>`
    } catch (err) {
        return null
    }
}

template.JSON = function (obj) {
    try {
        return `${JSON.stringify(obj, null, 4)}`
    } catch (err) {
        return null
    }
}

template.location = async function () {
    let cemetery = await expand(await get("l001"))
    if (!cemetery) {
        return null
    }
    return `<h2>${cemetery.label.value}</h2>
    <a href="${cemetery.seeAlso.value}" target="_blank" class="mc-see-also">${cemetery.seeAlso.value}</a>`
}

template.list = function (obj) {
    if (typeof obj.resources === "string") {
        get(obj.resources).then(function (ls) {
            obj.resources = ls
            return template.list(obj)
        })
    }
    let ul = `<p>${obj.label||"[ unlabeled ]"}</p>
    <ul class="mc-list">`
    for (var item of obj.resources) {
        ul += `<li><a href="#" onclick="mc.focusOn('${item['@id']}')">${item.label || "unlabeled"}</a></li>`
    }
    ul += `</ul>
    <button type="role" onclick="renderElement(mc.focusObject,template.person({}))">+</button>`
    return ul
}

template.byObjectType = async function (obj) {
    let templateFunction = function () {}
    switch (obj["@type"]) {
        case "Person":
            templateFunction = await template.person
            break
        case "List":
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
    setClass(obj["@type"])
    return templateFunction(obj)
}

template.person = function (obj, hideEditForm) {
    setClass("Person")
    let elem = `<h3>${(obj.label && obj.label.value) || obj.label || "unlabeled"}</h3>`
    let tmp = [
        template.fullName(obj),
        template.gender(obj),
        template.prop(obj, "mc:birthDate", "Birth Date"),
        template.prop(obj, "mc:deathDate", "Death Date"),
        template.evidence(obj)
    ]
    elem += tmp.join("\n")
    if (!hideEditForm) {
        let pForm = document.getElementById("mc-edit-form")
        pForm.innerHTML = template.personForm(obj)
        let elements = [].concat.apply([], pForm.getElementsByTagName("input"))
        elements = Array.prototype.concat.apply(elements, pForm.getElementsByTagName("textarea"))
        for (var el of elements) {
            el.onchange = function (event) {
                let prop = event.target.getAttribute("id").substr(3).replace(/(\-\w)/g, function (m) {
                    return m[1].toUpperCase();
                })
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

template.personForm = function (person) {
    return `<form class="mc-person-edit" onsubmit="${ person["@id"] && "editPerson()" || "createPerson()" }">
    <input type="hidden" mc-key="@type" value="Person" id="mc-type" >
    <input type="hidden" mc-key="@id" value="${person["@id"]}" id="mc-at-id" >
    <input id="mc-evidence" mc-key="mc:evidence" type="hidden" class="mc-data-entry" value="http://devstore.rerum.io/v1/id/5b76fc0de4b09992fca21e68" >
    <label for="mc-label">Full Name: 
        <input id="mc-label" type="text" mc-key="label" class="mc-data-entry" placeholder="full name" value="${ (person.label&&person.label.value) || (person.name&&person.name.value) || (person.label) || "" }" >
    </label>
    <label for="mc-birth-date">Birth Date: 
        <input id="mc-birth-date" mc-key="mc:birthDate" mc-source="${ person['mc:birthDate']&&person['mc:birthDate']['mc:source'] ||  person.birthDate&&person.birthDate['mc:source'] }" type="date" class="mc-data-entry" placeholder="YYYY-MM-DD" value="${ person['mc:birthDate']&&person['mc:birthDate'].value || person.birthDate&&person.birthDate.value || "" }" >
    </label>
    <label for="mc-death-date">Death Date: 
        <input id="mc-death-date" mc-key="mc:deathDate" mc-source="${ person['mc:deathDate']&&person['mc:deathDate']['mc:source'] ||  person.deathDate&&person.deathDate['mc:source'] }" type="date" class="mc-data-entry" placeholder="simple name" value="${ person['mc:deathDate']&&person['mc:deathDate'].value || person.deathDate&&person.deathDate.value || "" }" >
    </label>
    <label for="mc-given-name">Given Name: 
        <input id="mc-given-name" mc-key="mc:givenName" mc-source="${ person['mc:givenName']&&person['mc:givenName']['mc:source'] ||  person.givenName&&person.givenName['mc:source'] }" type="text" class="mc-data-entry" placeholder="first name" value="${ person['mc:givenName']&&person['mc:givenName'].value || person.givenName&&person.givenName.value || "" }" >
    </label>
    <label for="mc-family-name">Family Name: 
        <input id="mc-family-name" mc-key="mc:familyName" mc-source="${ person['mc:familyName']&&person['mc:familyName']['mc:source'] ||  person.familyName&&person.familyName['mc:source'] }" type="text" class="mc-data-entry" placeholder="last name" value="${ person['mc:familyName']&&person['mc:familyName'].value || person.familyName&&person.familyName.value || "" }" >
    </label>
    <label for="mc-maiden-name">Maiden Name: 
        <input id="mc-maiden-name" mc-key="mc:maidenName" mc-source="${ person['mc:maidenName']&&person['mc:maidenName']['mc:source'] || person.maidenName&&person.maidenName['mc:source'] }" type="text" class="mc-data-entry" placeholder="former name" value="${ person['mc:maidenName']&&person['mc:maidenName'].value || person.maidenName&&person.maidenName.value || "" }" >
    </label>
    <label for="mc-transcription">Catalog Entry: 
        <textarea id="mc-transcription" mc-key="mc:transcription" mc-source="${ person['mc:transcription']&&person['mc:transcription']['mc:source'] }" type="text" class="mc-data-entry" >${ person['mc:transcription']&&person['mc:transcription'].value || "" }</textarea>
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
    mc.focusObject.classList.remove("Event", "Person", "Location", "List", "Thing")
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
mc.focusObject.setAttribute("mc-object", "http://devstore.rerum.io/v1/id/5b998c95e4b09992fca21fd0")

async function editPerson() {

    let params = [];

    let dirtyFields = []
    for (let elem of document.getElementsByClassName("mc-data-entry")) {
        if (elem.$isDirty) {
            dirtyFields.push(elem)
        }
    }

    for (elem of dirtyFields) {
        const annoKey = elem.getAttribute("mc-key")
        let source = elem.getAttribute("mc-source")
        if (source === "undefined") {
            source = false
        }
        let config = {
            url: source ? UPDATE_URL : CREATE_URL,
            method: source ? "PUT" : "POST",
            body: {
                "@context": "",
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
            config.body["@id"] = elem.getAttribute("mc-source")
        }
        fetch(config.url, {
                method: config.method,
                headers: {
                    "Content-Type": "application/json; charset=utf-8"
                },
                body: JSON.stringify(config.body)
            }).catch(error => console.error('Error:', error))
            .then(response => response.json())
            .then(function (newState) {
                localStorage.setItem(newState["@id"], JSON.stringify(newState.new_obj_state))
                mc.focusOn(newState.new_obj_state.target)
            })
    }
}

async function updatePerson(person) {
    // change only the annotations
    let params = [UPDATE_URL, {
        method: "PUT",
        body: JSON.stringify(person),
        headers: {
            "Content-Type": "application/json"
        }
    }]
    const stored = await findByTargetId(findId)

    for (k of person) {
        let updateDetected = {
            key: false,
            value: ""
        }
        for (let i = 0; i < stored.length; i++) {
            for (let j = 0; j < stored[i].body.length; j++) {
                if (stored[i].body[j][k]) {
                    updateDetected.key = (stored[i].body[j][k].valueOf() !== person[k].valueOf())
                    let v = {}
                    v[k] = person[k]
                    updateDetected.value = JSON.stringify(v)
                    break
                } else {
                    updateDetected.key = false
                }
            }
        }
    }
}

async function createPerson() {
    let newPerson = {
        label: document.getElementById("mc-label").value,
        "@type": document.getElementById("mc-type").value,
        "@context": ""
    }
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
    list.resources.push({
        "@id": res.new_obj_state["@id"],
        "label": document.getElementById("mc-label").value
    })
    localStorage.setItem("li01", JSON.stringify(list))
    return editPerson()
}

const callback = function (error, response) {}

async function post(callback, url, data) {

    // TODO "async" and "await" this perhaps
    let xhr = new XMLHttpRequest()
    xhr.open("POST", url, false)
    xhr.setRequestHeader("Content-Type", "application/json")
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
            let res, err;
            if (xhr.status === 201) {
                try {
                    res = JSON.parse(xhr.response)
                } catch (error) {
                    err = error
                }
            } else {
                err = new Error(xhr.statusText || "Create failed.")
            }
            if (typeof callback === "function") {
                return callback(err, res)
            } else {
                return res
            }
            return err
        }
    }
    if (typeof data !== "string") {
        data = JSON.stringify(data)
    }
    xhr.send(data);
}
async function put(url, obj) {
    // TODO "async" and "await" this perhaps
    let xhr = new XMLHttpRequest()
    xhr.open("PUT", url, false)
    xhr.setRequestHeader("Content-Type", "application/json")
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
            let res, err;
            if (xhr.status === 201) {
                try {
                    res = JSON.parse(xhr.response)
                } catch (error) {
                    err = error
                }
            } else {
                err = new Error(xhr.statusText || "Update failed.")
            }
            if (typeof callback === "function") {
                return callback(err, res)
            } else {
                return res
            }
            return err
        }
    }
    if (typeof obj !== "string") {
        obj = JSON.stringify(obj)
    }
    xhr.send(obj);
}
