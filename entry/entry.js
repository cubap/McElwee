/*
 * McElwee data entry.
 *
 * Reads go straight to the RERUM API. Writes go to TinyNode with this project's access
 * token in the `Authorization` header - TinyNode's passthrough mode forwards it verbatim,
 * so RERUM stamps `__rerum.generatedBy` with the agent registered for this project rather
 * than with the TinyNode instance. The token itself is never stored here: it is minted on
 * demand by the local server (see server/), which is the only thing that reads the refresh
 * token off disk. The payloads are the same W3C annotation shapes the 2018 Java app
 * produced, so records written here still render in the exhibit.
 */
(function () {
  "use strict"

  var CFG = window.McElweeConfig
  var form = document.getElementById("person-form")
  var atId = document.getElementById("mc-at-id")
  var picker = document.getElementById("record-picker")
  var flash = document.getElementById("entry-flash")
  var saveButton = document.getElementById("save")
  var deleteButton = document.getElementById("delete")
  var heading = document.getElementById("form-heading")
  var fields = Array.prototype.slice.call(form.querySelectorAll("[mc-key]"))
  var people = []

  function message(kind, text) {
    flash.className = "entry-flash " + kind
    flash.textContent = text
    flash.hidden = false
  }

  function clearMessage() {
    flash.hidden = true
    flash.textContent = ""
  }

  function value(field) {
    return String(field.value || "").trim()
  }

  function fieldFor(key) {
    for (var i = 0; i < fields.length; i++) {
      if (fields[i].getAttribute("mc-key") === key) return fields[i]
    }
    return null
  }

  function unwrap(person, key) {
    var raw = person && person[key]
    if (!raw) return ""
    if (typeof raw === "object") return String(raw.value || "")
    return String(raw)
  }

  async function api(url, options) {
    var response = await fetch(url, options)
    var text = await response.text()
    var payload = null
    if (text) {
      try {
        payload = JSON.parse(text)
      } catch (err) {
        payload = { raw: text }
      }
    }
    if (!response.ok) {
      // TinyNode answers failures with a plain-text body, while the RERUM API answers with
      // JSON, so the message can be in any of these places. `raw` last, but not never: it is
      // the only one that carries RERUM's actual complaint through a TinyNode 401.
      var detail = payload && (payload.error || payload.message || payload.raw)
      var error = new Error(detail || "RERUM answered " + response.status + " for " + url)
      error.status = response.status
      throw error
    }
    return payload
  }

  /* --- the passthrough token ---------------------------------------------- */

  var accessToken = null
  var accessTokenExpiresAt = 0

  // Ask the local server for a usable access token, reusing the one we already hold while
  // it still has most of its hour left. `force` re-mints after a rejection, because the
  // server and this page can disagree about a token's life and RERUM can revoke early.
  async function mintToken(force) {
    var stillGood = accessToken && Date.now() < accessTokenExpiresAt - 60000
    if (accessToken && !force && stillGood) return accessToken
    if (!CFG.TOKEN_URL) {
      throw new Error("This page must be served by the local server in order to write. Run `npm start` and open http://localhost:3030/entry/.")
    }
    var minted = await api(CFG.TOKEN_URL, { method: "POST" })
    if (!minted || !minted.token) throw new Error("The local token mint answered without a token.")
    accessToken = minted.token
    accessTokenExpiresAt = minted.expiresAt ? Date.parse(minted.expiresAt) : 0
    return accessToken
  }

  function withBearer(options, token) {
    var merged = {}
    var key
    for (key in options) {
      if (Object.prototype.hasOwnProperty.call(options, key)) merged[key] = options[key]
    }
    merged.headers = {}
    for (key in (options && options.headers) || {}) {
      if (Object.prototype.hasOwnProperty.call(options.headers, key)) merged.headers[key] = options.headers[key]
    }
    merged.headers.Authorization = "Bearer " + token
    return merged
  }

  // A write, sent by this page with our own bearer token attached.
  //
  // The mint happens before the try: when the mint itself refuses, its message explains what
  // to fix in .env, and re-asking it would only repeat that. A 401 or 403 from the *write* is
  // retried once against a freshly minted token, because the server and this page can
  // disagree about a token's life and RERUM can revoke early. Any other status is the store's
  // own answer about the data and is reported as it arrived.
  async function write(url, options) {
    var token = await mintToken(false)
    try {
      return await api(url, withBearer(options, token))
    } catch (err) {
      if (err.status !== 401 && err.status !== 403) throw err
      return await api(url, withBearer(options, await mintToken(true)))
    }
  }

  function query(clauses) {
    return api(CFG.QUERY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(clauses)
    })
  }

  // The legacy annotations target the `http://` spelling of a person's IRI while the
  // person itself resolves over https, so look for both before concluding a value is
  // unsourced. New annotations this form writes use the https form.
  async function queryByTarget(id) {
    var variants = CFG.idVariants(id)
    var found = []
    var seen = {}
    for (var i = 0; i < variants.length; i++) {
      var results = await query({ target: variants[i] }).catch(function () { return [] })
      if (!Array.isArray(results)) continue
      for (var j = 0; j < results.length; j++) {
        var annoId = results[j] && results[j]["@id"]
        if (!annoId || seen[annoId]) continue
        seen[annoId] = true
        found.push(results[j])
      }
    }
    return found
  }

  /* --- agent banner ------------------------------------------------------- */

  async function showAgent() {
    var box = document.getElementById("agent-status")
    if (!CFG.AGENT_URL) {
      box.className = "agent-status bad"
      box.textContent = "This page must be served by the local server. Run `npm start` and open http://localhost:3030/entry/."
      return
    }
    try {
      var status = await api(CFG.AGENT_URL, { method: "GET" })
      if (status.problem) {
        box.className = "agent-status bad"
        box.innerHTML = "<strong>Not writing yet.</strong> " + status.problem
        saveButton.disabled = true
        return
      }
      box.className = "agent-status ok"
      box.innerHTML =
        "Writes are attributed to <code>" + status.agentIri + "</code>" +
        (status.tokenExpiresAt ? ", token valid until " + status.tokenExpiresAt : "") +
        ".<br>Reads from <code>" + status.apiAddr + "</code>; writes pass through <code>" + status.tinynodeAddr + "</code>"
    } catch (err) {
      box.className = "agent-status bad"
      box.textContent = "Could not reach the local server: " + err.message
      saveButton.disabled = true
    }
  }

  /* --- record browser ----------------------------------------------------- */

  async function loadPeople() {
    var listId = CFG.normalizeId(localStorage.getItem("CURRENT_LIST_ID")) || CFG.DEFAULT_LIST_ID
    var list
    try {
      list = await api(listId, { method: "GET" })
    } catch (err) {
      picker.innerHTML = '<option value="">The population list could not be loaded.</option>'
      message("error", err.message)
      return
    }
    people = (list.itemListElement || []).map(function (item) {
      return { id: recordId(item), name: item.name || "(unrecorded)" }
    })
    people.sort(function (a, b) {
      return a.name.localeCompare(b.name)
    })
    picker.innerHTML = '<option value="">Choose a person&hellip;</option>' +
      people.map(function (p) {
        return '<option value="' + p.id + '">' + p.name + "</option>"
      }).join("")
  }

  async function loadPerson(id) {
    clearMessage()
    atId.value = id
    var person = await api(id, { method: "GET" })
    ;["name", "givenName", "familyName", "alternateName", "gender", "birthDate", "deathDate", "depiction", "description"].forEach(function (key) {
      var field = fieldFor(key)
      if (field) field.value = unwrap(person, key)
    })
    // Remember which annotation asserted each value so saving updates it instead of
    // stacking a second claim on top of the first.
    var annotations = await queryByTarget(id)
    ;(Array.isArray(annotations) ? annotations : []).forEach(function (anno) {
      var bodies = Array.isArray(anno.body) ? anno.body : [anno.body]
      bodies.forEach(function (body) {
        Object.keys(body || {}).forEach(function (key) {
          var field = fieldFor(key)
          if (field) field.setAttribute("data-source", recordId(anno) || "")
        })
      })
    })
  }

  function resetForm() {
    clearMessage()
    atId.value = ""
    fields.forEach(function (field) {
      if (field.type !== "hidden") field.value = ""
      field.removeAttribute("data-source")
      field.removeAttribute("data-original")
    })
    heading.textContent = "New person"
    saveButton.textContent = "Create"
    deleteButton.hidden = true
  }

  /* --- writing ------------------------------------------------------------ */

  async function createPersonRecord() {
    var nameField = fieldFor("name")
    if (!value(nameField)) throw new Error("A full name is required before a person can be created.")
    var created = await write(CFG.CREATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        "@context": fieldFor("@context").value,
        "@type": fieldFor("@type").value,
        name: value(nameField)
      })
    })
    var newId = CFG.normalizeId(created["@id"] || (created.new_obj_state && created.new_obj_state["@id"]))
    if (!newId) throw new Error("RERUM created the person but did not return an @id.")
    atId.value = newId
    await addToPopulationList(newId, value(nameField))
    return newId
  }

  async function addToPopulationList(id, name) {
    var listId = CFG.normalizeId(localStorage.getItem("CURRENT_LIST_ID")) || CFG.DEFAULT_LIST_ID
    var list = await api(listId, { method: "GET" })
    var elements = list.itemListElement || []
    var alreadyThere = elements.some(function (item) {
      return recordId(item) === id
    })
    if (alreadyThere) return
    elements.push({ "@id": id, "@type": "Person", name: name })
    list.itemListElement = elements
    list.numberOfItems = elements.length
    await write(CFG.UPDATE_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(list)
    })
  }

  async function saveField(field) {
    var key = field.getAttribute("mc-key")
    var target = atId.value
    var source = field.getAttribute("data-source")
    var body = {}
    body[key] = { value: value(field), evidence: CFG.EVIDENCE_ID }

    if (source) {
      var updated = await write(CFG.UPDATE_URL, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          "@context": "http://www.w3.org/ns/anno.jsonld",
          "@type": "Annotation",
          "@id": source,
          motivation: "describing",
          target: target,
          body: body
        })
      })
      return updated
    }

    return write(CFG.CREATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        "@context": "http://www.w3.org/ns/anno.jsonld",
        "@type": "Annotation",
        motivation: "describing",
        target: target,
        body: body
      })
    })
  }

  async function onSubmit(event) {
    event.preventDefault()
    clearMessage()
    saveButton.disabled = true
    try {
      if (!atId.value) await createPersonRecord()
      var dirty = fields.filter(function (field) {
        if (field.type === "hidden" || field.getAttribute("mc-key").charAt(0) === "@") return false
        return value(field) !== (field.getAttribute("data-original") || "")
      })
      if (!dirty.length) {
        message("success", "Nothing changed, so nothing was written.")
        return
      }
      var saved = 0
      for (var i = 0; i < dirty.length; i++) {
        await saveField(dirty[i])
        saved++
      }
      message("success", saved + " field" + (saved === 1 ? "" : "s") + " written to RERUM as " + CFG.normalizeId(atId.value) + ".")
      snapshotOriginals()
      deleteButton.hidden = false
      await loadPeople().catch(function () {})
    } catch (err) {
      message("error", err.message)
    } finally {
      saveButton.disabled = false
    }
  }

  function snapshotOriginals() {
    fields.forEach(function (field) {
      if (field.type !== "hidden") field.setAttribute("data-original", value(field))
    })
    heading.textContent = "Editing " + (value(fieldFor("name")) || atId.value)
    saveButton.textContent = "Update"
  }

  async function onDelete() {
    var id = atId.value
    if (!id) return
    var name = value(fieldFor("name")) || id
    if (!window.confirm("Delete " + name + " from the RERUM store?\n\n" + id + "\n\nThis cannot be undone from this page.")) return
    try {
      // TinyNode's delete takes the bare local id in the path, not the full IRI.
      await write(CFG.DELETE_URL + "/" + encodeURIComponent(id.split("/").pop()), { method: "DELETE" })
      resetForm()
      await loadPeople()
      message("success", "Deleted " + name + ".")
    } catch (err) {
      message("error", err.message)
    }
  }

  /* --- wiring ------------------------------------------------------------- */

  picker.addEventListener("change", async function () {
    var id = picker.value
    if (!id) return
    clearMessage()
    try {
      await loadPerson(id)
      snapshotOriginals()
      deleteButton.hidden = false
    } catch (err) {
      message("error", err.message)
    }
  })

  document.getElementById("new-person").addEventListener("click", function () {
    picker.value = ""
    resetForm()
  })

  form.addEventListener("submit", onSubmit)
  deleteButton.addEventListener("click", onDelete)

  showAgent()
  loadPeople()
  resetForm()
})()
