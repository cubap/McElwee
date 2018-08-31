// TODO: custom elements when behaviors are needed.
// class McView extends HTMLDivElement {
//     constructor() {
//         super()
//     }
// }
// customElements.define("mc-view",McView,{extends:"div"})
var mc = {}
mc.focusObject = document.getElementById("mc-view")

mc.focusOn = function(id) {
    mc.focusObject.setAttribute('mc-object', id)
}

async function get(url) {

    // shortcut
    if (url.length < 6) {
        return JSON.parse(localStorage.getItem(url))
    }

    const response = await fetch(url)
    const json = await response.json()
    return response.ok ? json : Promise.reject(json)
}

async function expand(obj) {
    let toRender = {}
    let findId = obj["@id"]
    let annos = await findByTargetId(findId)
        // TODO: attach evidence to each property value
        // add each value in a predictable way
        // type properties for possible rendering?
    for (let i = 0; i < annos.length; i++) {
        for (let j = 0; j < annos[i].body.length; j++) {
            if (annos[i].body[j].evidence) {
                let evId = (typeof annos[i].body[j].evidence === "object") ? annos[i].body[j].evidence["@id"] : annos[i].body[j].evidence
                obj.evidence = await get(evId)
            } else {
                obj = Object.assign(annos[i].body[j], obj)
            }
        }
    }
    return obj
}

async function findByTargetId(id) {
    let everything = Object.keys(localStorage).map(k => (k && k.length === 4) && JSON.parse(localStorage.getItem(k)))
    let matches = everything.filter(o => o.target === id)
    if (matches) return matches
    let obj = {
        target: id
    }
    matches = await fetch("http://tinydev.rerum.io/app/query",{
        method: "POST",
        body: JSON.stringify(obj),
        headers: { "Content-Type": "application/json" }
    })
    return matches
}

var template = {}

template.evidence = function(obj) {
    if (!obj.evidence) { return null }
    return `<a class="mc-evidence" href="${(typeof obj.evidence === "object") ? obj.evidence["@id"] : obj.evidence}" target="_blank">${obj.evidence.label || "View evidence"}</a>`
}

template.fullName = function(obj) {
    if (!obj || !(obj.givenName || obj.familyName)) { return null }
    return `<div class="mc-name">${obj.familyName||"[ unknown ]"}, ${obj.givenName}</div>`
}

template.prop = function(obj, prop) {
    if (!obj.hasOwnProperty(prop)) { return `` }
    return `<span class="mc-${prop.trim().replace(/\s+/g,"-").normalize("NFC").toLowerCase()}">${prop}: ${obj[prop] || "[ undefined ]"}</span>`
}

template.gender = function(obj) {
    return `<span class="mc-gender">${(obj.gender === "male") ? "&male;" : "&female;"}</span>`
}

template.JSON = function(obj) {
    try {
        return `${JSON.stringify(obj, null, 4)}`
    } catch (err) {
        return null
    }
}

template.location = async function() {
    let cemetery = await expand(await get("l001"))
    if (!cemetery) { return null }
    return `<h2>${cemetery.label}</h2>
    <a href="${cemetery.seeAlso}" target="_blank" class="mc-see-also">${cemetery.seeAlso}</a>`
}

template.list = function(obj) {
    if (typeof obj.resources === "string") {
        get(obj.resources).then(function(ls) {
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

template.byObjectType = async function(obj) {
    let templateFunction = function() {}
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

template.person = function(obj, hideEditForm) {
    setClass("Person")
    let elem = `<h3>${obj.label || "unlabeled"}</h3>`
    let tmp = [
        template.fullName(obj),
        template.gender(obj),
        template.prop(obj, "birthDate"),
        template.prop(obj, "deathDate"),
        template.evidence(obj)
    ]
    elem += tmp.join("\n")
    if (!hideEditForm) {
        let pForm = document.getElementById("mc-edit-form")
        pForm.innerHTML = template.personForm(obj)
        let elements = [].concat.apply([], pForm.getElementsByTagName("input"))
        elements = Array.prototype.concat.apply(elements, pForm.getElementsByTagName("textarea"))
        for (var el of elements) {
            el.onchange = function(event) {
                let prop = event.target.getAttribute("id").substr(3).replace(/(\-\w)/g, function(m) { return m[1].toUpperCase(); })
                obj[prop] = event.target.value
                renderElement(mc.focusObject, template.person(obj, true))
                renderElement(document.getElementById("obj-viewer"), template.JSON(obj))
                obj.$isDirty = true
                document.getElementById("mc-edit-form").getElementsByTagName("button")[0].style = "display:block;"
                document.getElementById("mc-edit-form").onsubmit = obj["@id"]?'editPerson("update")':'editPerson("create")'
            }
            el.addEventListener('input', el.onchange)
        }
    }
    return elem
}

template.personForm = function(person) {
    return `<form class="mc-person-edit" onsubmit="editPerson(${person["@id"]?"'update'":"'create'"})">
    <input type="hidden" value="Person" id="mc-type" >
    <input type="hidden" value="${person["@id"]}" id="mc-at-id" >
    <label for="mc-label">Full Name: 
        <input id="mc-label" type="text" placeholder="full name" value="${ person.label || person.name || "" }" >
    </label>
    <label for="mc-birth-date">Birth Date: 
        <input id="mc-birth-date" type="date" placeholder="YYYY-MM-DD" value="${ person.birthDate || "" }" >
    </label>
    <label for="mc-death-date">Death Date: 
        <input id="mc-death-date" type="date" placeholder="simple name" value="${ person.deathDate || "" }" >
    </label>
    <label for="mc-given-name">Given Name: 
        <input id="mc-given-name" type="text" placeholder="first name" value="${ person.givenName || "" }" >
    </label>
    <label for="mc-family-name">Family Name: 
        <input id="mc-family-name" type="text" placeholder="last name" value="${ person.familyName || "" }" >
    </label>
    <label for="mc-maiden-name">Maiden Name: 
        <input id="mc-maiden-name" type="text" placeholder="former name" value="${ person.maidenName || "" }" >
    </label>
    <label for="mc-evidence">Evidence: 
    <input id="mc-evidence" type="url" placeholder="just urls for now" value="http://devstore.rerum.io/v1/id/5b76fc0de4b09992fca21e68" >
    </label>
    <label for="mc-transcription">Catalog Entry: 
        <textarea id="mc-transcription" type="text" >${ person.transcription || "" }</textarea>
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
mc.focusObject.setAttribute("mc-object", "li01")

const CREATE_URL = "http://tinydev.rerum.io/app/create"
const UPDATE_URL = "http://tinydev.rerum.io/app/update"

async function editPerson(action) {
    var obj = {
        "@type": "Person",
        "@context": "",
        "label": document.getElementById("mc-label") || "[ unlabeled ]",
    }
    let params = [];
    switch (action) {
        case "update": params = [UPDATE_URL, {
            method: "PUT",
            body: JSON.stringify(obj),
            headers: { "Content-Type": "application/json" }
        }]
        break
        case "create": params = [CREATE_URL, {
            method: "POST",
            body: JSON.stringify(obj),
            headers: { "Content-Type": "application/json" }
        }]
        break
        default: return false
    }
    return fetch(...params).catch(error => console.error('Error:', error))
    .then(function(response){
        let oldId = obj["@id"]
        obj["@id"] = response.getHeader("Location")
        let values = [
            { "label": document.getElementById("mc-label").value },
            { "transcription": document.getElementById("mc-transcription").value },
            { "givenName": document.getElementById("mc-givenname").value },
            { "familyName": document.getElementById("mc-familyname").value },
            { "maidenName": document.getElementById("mc-maidenname").value },
            { "gender": fdocumentodocumentrm.getElementById("mc-gender").value },
            { "evidence": "http://devstore.rerum.io/v1/id/5b76fc0de4b09992fca21e68" }
        ]
        if(action==="update") {values.push({"@id":window["mc-at-id"].value})}
        let annos = {
            "@context": "",
            "@type": "Annotation",
            "motivation": "describing",
            "target": obj["@id"],
            "body": []
        }
        for(var o of values) {
            if(o[Object.keys(o)[0]].length > 0) {
                annos.body.push()
            }
        }
        let list = get("li01")
        if(oldId){
            list.resources.forEach(function(item,i){
                if((item["@id"]||item)===oldId){
                    list.resources[i] = {
                        "@id": obj["@id"],
                        "label": obj.label
                    }
                }
            })
        } else {
            list.resources.push({
                "@id": obj["@id"],
                "label": obj.label
            })
        }
        // return fetch(UPDATE_URL)
        localStorage.setItem("li01",list)
    })
}

const callback = function(error, response) {
}

async function post(callback, url, data) {

    // TODO "async" and "await" this perhaps
    let xhr = new XMLHttpRequest()
    xhr.open("POST", url, false)
    xhr.setRequestHeader("Content-Type", "application/json")
    xhr.onreadystatechange = function() {
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
    xhr.onreadystatechange = function() {
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