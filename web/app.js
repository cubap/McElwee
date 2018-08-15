var mc = {}
mc.focusObject = document.getElementById("mc-view")

mc.focusOn = function (id) {
    mc.focusObject.setAttribute('mc-object', id)
}

function get(url) {

    // shortcut
    if (url.length < 6) {
        return JSON.parse(localStorage.getItem(url))
    }

    let xhr = new XMLHttpRequest();
    xhr.open("GET", url);
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
            let obj, err;
            if (xhr.status === 200) {
                try {
                    obj = JSON.parse(xhr.response);
                } catch (error) {
                    err = error;
                }
            } else {
                err = new Error(xhr.statusText || "GET failed.");
            }
            if (typeof callback === "function") {
                return callback(err, obj);
            }
            return obj;
        }
    };
    xhr.send();
}

function expand(obj) {
    let toRender = {}
    let findId = obj["@id"]
    let annos = findById(findId)
    // TODO: attach evidence to each property value
    // add each value in a predictable way
    // type properties for possible rendering?
    for (let i = 0; i < annos.length; i++) {
        for (let j = 0; j < annos[i].body.length; j++) {
            if (annos[i].body[j].evidence) {
                let evId = (typeof annos[i].body[j].evidence === "object") ? annos[i].body[j].evidence["@id"] : annos[i].body[j].evidence
                obj.evidence = JSON.parse(localStorage.getItem(evId))
            } else {
                obj = Object.assign(annos[i].body[j], obj)
            }
        }
    }
    return obj
}

function findById(id) {
    let everything = Object.keys(localStorage).map(k => (k && k.length === 4) && JSON.parse(localStorage.getItem(k)))
    let matches = everything.filter(o => o.target === id)
    return matches
}

var template = {}

template.evidence = function (obj) {
    if (!obj.evidence) {return null}
    return `<a class="mc-evidence" href="${(typeof obj.evidence === "object") ? obj.evidence["@id"] : obj.evidence}" target="_blank">${obj.evidence.label || "View evidence"}</a>`
}

template.fullName = function (obj) {
    if (!obj || !(obj.givenName || obj.familyName)) {return null}
    return `<span class="mc-name">${obj.familyName||"[ unknown ]"}, ${obj.givenName}</span>`
}

template.prop = function (obj, prop) {
    if(!obj.hasOwnProperty(prop)) {return ``}
    return `<span class="mc-${prop.trim().replace(/\s+/g,"-").normalize("NFC").toLowerCase()}">${prop}: ${obj[prop] || "[ undefined ]"}</span>`
}

template.gender = function (obj) {
    return `<span class="mc-gender">${(obj.gender === "male") ? "&male;" : "&female;"}</span>`
}

template.JSON = function (obj) {
    try{
        return `${JSON.stringify(obj, null, 4)}`
    }
    catch (err){
        return null
    }
}

template.location = function () {
    let cemetery = expand(JSON.parse(localStorage.getItem("l001")))
    if(!cemetery) {return null}
    return `<h2>${cemetery.label}</h2>
    <a href="${cemetery.seeAlso}" target="_blank" class="mc-see-also">${cemetery.seeAlso}</a>`
}

template.personForm = function (person) {
    return `<form>
    <label for="mc-label">Label: <input id="mc-label" type="text" placeholder="simple name" value="${ person.label }" ></label>
    </form>`
}

template.list = function (obj, elem) {
    if (typeof obj.resources === "string") {
        get(obj.resources).then(function (ls) {
            obj.resources = ls
            return template.list(obj, elem)
        })
    }
    let ul = `<ul class="mc-list">`
    for (var item of obj.resources) {
        ul += `<li><a href="#" onclick="mc.focusOn('${item['@id']}')">${item.label || "unlabeled"}</a></li>`
    }
    return ul += `</ul>`
}

template.byObjectType = function (obj) {
    let templateFunction = function () {}
    switch (obj["@type"]) {
        case "Person":
            templateFunction = template.person
            break
        case "List":
            templateFunction = template.list
            break
        case "Location":
            templateFunction = template.location
            break
        case "Event":
            templateFunction = template.event
            break
        default:
            return null
    }
    setClass(obj["@type"])
    return templateFunction(obj)
}

template.person = function (obj) {
    let elem = `<h3>${obj.label || "unlabeled"}</h3>`
    let tmp = [
        template.fullName(obj),
        template.gender(obj),
        template.prop(obj, "birthDate"),
        template.prop(obj, "deathDate"),
        template.evidence(obj)
    ]
    elem += tmp.join("\n")
    document.getElementById("mc-person-form").innerHTML = template.personForm(obj)
    return elem
}

function renderElement(elem, tmp) {
    while (elem.firstChild) {
        elem.removeChild(elem.firstChild)
    }
    if (tmp) {
        elem.innerHTML = tmp
    }
}

function setClass(className) {
    mc.focusObject.classList.remove("Event", "Person", "Location", "List", "Thing")
    mc.focusObject.classList.add(className)
}

function observerCallback(mutationsList) {
    for (var mutation of mutationsList) {
        if (mutation.attributeName === "mc-object") {
            let id = mc.focusObject.getAttribute("mc-object")
            let data = expand(JSON.parse(localStorage.getItem(id)))
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

const CREATE_URL = "http://tiny.rerum.io/app/create"

function createPerson() {
    const callback = function (error, result) {
        // create, rewrite id
    }
    let form = document.getElementById("mc-person-form")
    // TODO: Make this make sense
    let obj = {
        "@type": "Person",
        "label": form.getElementById("mc-label"),
        "transcription": form.getElementById("mc-transcription"),
        "@context": "",
        "givenName": form.getElementById("mc-givenname"),
        "familyName": form.getElementById("mc-familyname"),
        "gender": form.getElementById("mc-gender")
    }
}

function post(callback, url, obj) {
    let xhr = new XMLHttpRequest();
    xhr.open("POST", url, false);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
            let res, err;
            if (xhr.status === 201) {
                try {
                    res = JSON.parse(xhr.response);
                } catch (error) {
                    err = error;
                }
            } else {
                err = new Error(xhr.statusText || "Create failed.");
            }
            if (typeof callback === "function") {
                return callback(err, res);
            }
            return err;
        }
    };
    if (typeof obj !== "string") {
        obj = JSON.stringify(obj);
    }
    xhr.send(obj);
}