var mc = {}
mc.focusObject = document.getElementById("mc-view")

function focusOn(id) {
    mc.focusObject.setAttribute('mc-object', id)
}
async function get(url) {

    // shortcut
    if (url.length < 6) {
        return JSON.parse(localStorage.getItem(url))
    }

    let xhr = new XMLHttpRequest();
    xhr.open("GET", url);
    xhr.onreadystatechange = function() {
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

function templateEvidence(obj) {
    if (!obj.evidence) return false
    let evidence = document.createElement("a")
    let elink = (typeof obj.evidence === "object") ? obj.evidence["@id"] : obj.evidence
    evidence.setAttribute("href", elink)
    evidence.setAttribute("target", "_blank")
    evidence.className = "mc-evidence"
    evidence.textContent = obj.evidence.label || "View evidence"
    return evidence
}

function templatePerson(obj) {
    let template = document.createElement("div")
    template.innerHTML = "<h3>" + (obj.label || "unlabeled") + "</h3>"
    let tmp = [
        templateName(obj),
        templateGender(obj),
        templateProp(obj, "birthDate"),
        templateProp(obj, "deathDate"),
        templateEvidence(obj) ]
    for (e of tmp) {
        if(e){template.append(e)}
    }
    document.getElementById("mc-person-form").innerHTML = templatePersonForm(obj)
    return template
}

function templateName(obj) {
    let elem;
    if (obj.familyName && obj.givenName) {
        let joined = obj.familyName + ", " + obj.givenName;
        elem = document.createElement("span")
        elem.textContent = joined
        elem.className = "mc-name"
    }
    return elem || null
}

function templateProp(obj, prop) {
    let elem;
    if (obj[prop]) {
        elem = document.createElement("div")
        elem.textContent = prop + ": " + obj[prop]
        elem.className = "mc-" + prop
    }
    return elem || null
}

function templateGender(obj) {
    let elem;
    if (obj.gender) {
        elem = document.createElement("span")
        elem.innerHTML = (obj.gender === "male") ? "&male;" : "&female;"
        elem.className = "mc-gender"
    }
    return elem || null
}

function templateJSON(obj) {
    return document.createElement("span").textContent = JSON.stringify(obj, null, 4)
}

function templateLocation() {
    let template = document.createElement("div")
    let cemetery = expand(JSON.parse(localStorage.getItem("l001")))
    template.innerHTML = "<h2>" + cemetery.label + "</h2>"
    let ref = document.createElement("a")
    ref.setAttribute("href", cemetery.seeAlso)
    ref.setAttribute("target", "_blank")
    ref.className = "seeAlso"
    ref.textContent = cemetery.seeAlso
    template.append(ref)
    return template
}

function renderElement(elem,template){
    while (elem.firstChild){
        elem.removeChild(elem.firstChild)
    }
    if(template) {
        elem.append(template)
    }
}

function setClass(className){
    mc.focusObject.classList.remove("Event","Person","Location","List","Thing")
    mc.focusObject.classList.add(className)
}

function loadLists(locationId) {
    // find references to location
    // parse list for people
}

function renderResidents(list) {
    // create links for each person in the location
    // render on click
}

function templateList(obj, elem) {
    if (typeof obj.resources === "string") {
        get(obj.resources).then(function(ls) {
            obj.resources = ls
            return templateList(obj, elem)
        })
    }
    let ul = document.createElement("ul")
    for (item of obj.resources) {
        let li = document.createElement("li")
        let alink = document.createElement("a")
        alink.innerText = item.label || "unlabeled"
        alink.setAttribute("href", "javascript:void")
        alink.setAttribute("onclick", ("focusOn('" + item['@id'] + "')"))
        li.append(alink)
        ul.append(li)
    }
    return ul
}

function observerCallback(mutationsList) {
    for (var mutation of mutationsList) {
        if (mutation.attributeName === "mc-object") {
            let id = mc.focusObject.getAttribute("mc-object")
            let data = expand(JSON.parse(localStorage.getItem(id)))
            renderElement(mc.focusObject, templateByObjectType(data))
            renderElement(document.getElementById("obj-viewer"),templateJSON(data))
        }
        console.log(mutation)
    }
}

function templateByObjectType(obj) {
    let templateFunction = function() {}
    switch (obj["@type"]) {
        case "Person":
            templateFunction = templatePerson
            break
        case "List":
            templateFunction = templateList
            break
        case "Location":
            templateFunction = templateLocation
            break
        case "Event":
            templateFunction = templateEvent
            break
        default: return null
    }
    setClass(obj["@type"])
    return templateFunction(obj)
}

mc.renderObserver = new MutationObserver(observerCallback)
mc.renderObserver.observe(mc.focusObject, {
    attributes: true
})


// load defaulty bits
renderElement(document.getElementById("mc-location"),templateLocation())
mc.focusObject.setAttribute("mc-object", "li01")

const CREATE_URL = "http://tiny.rerum.io/app/create"

function createPerson(){
    const callback = function(error,result){
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

function templatePersonForm(person) {
    return `<form>
    <label for="mc-label">Label: <input id="mc-label" type="text" placeholder="simple name" value="${ person.label }" ></label>
    </form>`
}

function post (callback, url, obj) {
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