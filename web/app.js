async function get(url) {

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

function renderEvidence(obj) {
    let evidence = document.createElement("a")
    let elink = (typeof obj.evidence === "object") ? obj.evidence["@id"] : obj.evidence
    evidence.setAttribute("href", elink)
    evidence.setAttribute("target", "_blank")
    evidence.className = "mc-evidence"
    evidence.textContent = obj.evidence.label || "View evidence"
    return evidence
}

function renderPerson(obj, elem) {
    elem.innerHTML = "<h3>" + (obj.label || "unlabeled") + "</h3>"
    elem.append(renderName(obj))
    elem.append(renderGender(obj))
    elem.append(renderProp(obj, "birthDate"))
    elem.append(renderProp(obj, "deathDate"))
    elem.append(renderEvidence(obj))
    document.getElementById("obj-viewer").append(renderObject(obj))
}

function renderName(obj) {
    let elem;
    let joined = obj.familyName + ", " + obj.givenName;
    if (joined) {
        elem = document.createElement("span")
        elem.textContent = joined
        elem.className = "mc-name"
    }
    return elem || null
}

function renderProp(obj, prop) {
    let elem;
    if (obj[prop]) {
        elem = document.createElement("div")
        elem.textContent = prop + ": " + obj[prop]
        elem.className = "mc-" + prop
    }
    return elem || null
}

function renderGender(obj) {
    let elem;
    if (obj.gender) {
        elem = document.createElement("span")
        elem.innerHTML = (obj.gender === "male") ? "&male;" : "&female;"
        elem.className = "mc-gender"
    }
    return elem || null
}

function renderObject(obj) {
    return document.createElement("span").textContent = JSON.stringify(obj, null, 4)
}

function renderLocation() {
    let elem = document.getElementById("mc-location")
    let cemetery = expand(JSON.parse(localStorage.getItem("l001")))
    elem.innerHTML = "<h2>" + cemetery.label + "</h2>"
    let ref = document.createElement("a")
    ref.setAttribute("href", cemetery.seeAlso)
    ref.setAttribute("target", "_blank")
    ref.className = "seeAlso"
    ref.textContent = cemetery.seeAlso
    elem.append(ref)
}

function loadLists(locationId) {
    // find references to location
    // parse list for people
}

function renderResidents(list) {
    // create links for each person in the location
    // render on click
}

// load defaulty bits
renderLocation()
renderPerson(expand(JSON.parse(localStorage.getItem("p001"))), document.getElementById("view"))