/**
 * The Atlas — a plat-map viewer and family browser for the McElwee cemetery.
 *
 * This is a different artifact from the specimen sheet and the burial ledger, so it is
 * mounted differently: the plat maps are somebody else's scans, held by the State
 * Historical Society of Missouri, and read live from their IIIF endpoint. The exhibit
 * credits them and links back, per the collection's requirement, and never copies a scan
 * into the repository.
 *
 * The family browser is the research layer on top. It groups the cemetery's families by
 * surname, lists each family's members from the burial index (so the list can never drift
 * from what the index holds), and shows any property that has been verified on a plat.
 *
 * Data:
 *   - web/data/atlas.json   the verified plate index + family research notes
 *   - web/data/burials.json the burial index (for surname/member grouping)
 *
 * The plate itself is always served live by the <mc-atlas-viewer> element.
 */

(function () {
  "use strict"

  var data = null
  var burials = null
  var openSurname = null
  var openPlateId = null
  var el = {}

  function esc(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;")
  }

  function grab() {
    ;["mc-atlas", "mc-atlas-count", "mc-atlas-families", "mc-atlas-viewer", "mc-atlas-plate-select",
      "mc-atlas-plate-title", "mc-atlas-plate-link", "mc-atlas-clear"]
      .forEach(function (id) { el[id.replace(/^mc-atlas-?/, "atlas-")] = document.getElementById(id) })
    // The viewer and clear live outside the grab prefix mapping.
    el["viewer"] = document.getElementById("mc-atlas-viewer")
    el["clear"] = document.getElementById("mc-atlas-clear")
    el["select"] = document.getElementById("mc-atlas-plate-select")
    el["plateTitle"] = document.getElementById("mc-atlas-plate-title")
    el["plateLink"] = document.getElementById("mc-atlas-plate-link")
  }

  function dataUrl(name) {
    return new URL("data/" + name, document.baseURI).href
  }

  function labelOf(plate) {
    return plate.label || ("Plat " + plate.id)
  }

  /* --- surname grouping ---------------------------------------------------- */

  function families() {
    // Family notes are keyed by surname in atlas.json (e.g. "McElwee") but the burial
    // index stores surnames uppercase (e.g. "McELWEE"). Match case-insensitively so the
    // research note is found for either spelling.
    var notes = {}
    ;(data.families || []).forEach(function (f) { notes[f.surname.toLowerCase()] = f })
    var grouped = {}
    ;(burials.records || []).forEach(function (r) {
      var s = r.surname || "(unassigned)"
      if (!grouped[s]) {
        grouped[s] = { surname: s, members: [], note: notes[s.toLowerCase()] }
      }
      grouped[s].members.push(r)
    })
    return Object.keys(grouped).map(function (s) {
      return grouped[s]
    }).sort(function (a, b) {
      return a.surname.localeCompare(b.surname, "en")
    })
  }

  function familiesWithMembers() {
    return families().filter(function (f) { return f.members.length > 0 })
  }

  function familyOf(surname) {
    return families().find(function (f) { return f.surname === surname })
  }

  /* --- render -------------------------------------------------------------- */

  function indexSort(a, b) {
    return a.surname.localeCompare(b.surname, "en")
  }

  function renderFamilies() {
    var list = familiesWithMembers()
    el["atlas-count"].textContent = list.length + (list.length === 1 ? " family" : " families")

    var frag = document.createDocumentFragment()
    list.forEach(function (f) {
      var li = document.createElement("li")
      li.className = "mc-atlas-family" + (f.surname === openSurname ? " is-open" : "")
      li.dataset.surname = f.surname

      var btn = document.createElement("button")
      btn.type = "button"
      btn.className = "mc-atlas-family-btn"
      btn.setAttribute("aria-expanded", String(f.surname === openSurname))
      btn.innerHTML =
        '<span class="mc-atlas-family-name">' + esc(f.surname) + '</span>' +
        '<span class="mc-atlas-family-count">' + f.members.length + '</span>'
      li.appendChild(btn)

      if (f.surname === openSurname) {
        li.appendChild(buildFamilyPanel(f))
      }
      frag.appendChild(li)
    })

    el["atlas-families"].innerHTML = ""
    el["atlas-families"].appendChild(frag)

    // Enable the clear control once a surname is open.
    if (el.clear) el.clear.hidden = !openSurname
  }

  function buildFamilyPanel(f) {
    var panel = document.createElement("div")
    panel.className = "mc-atlas-family-panel"

    if (f.note && f.note.note) {
      var p = document.createElement("p")
      p.className = "mc-atlas-family-note"
      p.textContent = f.note.note
      panel.appendChild(p)
    }

    if (f.members.length) {
      var members = document.createElement("div")
      members.className = "mc-atlas-members"
      members.appendChild(memberHeading("Members in the burial index"))
      var ol = document.createElement("ul")
      f.members.forEach(function (m) {
        var li = document.createElement("li")
        var name = m.givenName ? ((m.surname ? m.surname + " " : "") + m.givenName) : (m.surname || "(no name)")
        var a = document.createElement("a")
        a.href = "#burial/" + encodeURIComponent(m.id)
        a.className = "mc-atlas-member"
        a.textContent = name
        li.appendChild(a)
        ol.appendChild(li)
      })
      members.appendChild(ol)
      panel.appendChild(members)
    }

    var props = (f.note && f.note.properties) || []
    if (props.length) {
      var propsBox = document.createElement("div")
      propsBox.className = "mc-atlas-properties"
      propsBox.appendChild(memberHeading("Recorded property"))
      props.forEach(function (prop) {
        var plate = plateById(prop.plateId)
        var row = document.createElement("p")
        row.className = "mc-atlas-property" + (prop.verified ? " mc-atlas-property--verified" : " mc-atlas-property--unverified")
        var view = document.createElement("button")
        view.type = "button"
        view.className = "mc-atlas-property-view"
        view.dataset.plateId = prop.plateId
        view.textContent = (plate ? labelOf(plate) : prop.label || ("Plat " + prop.plateId)) + " \u2192"
        row.appendChild(view)
        if (prop.note) {
          var span = document.createElement("span")
          span.className = "mc-atlas-property-note"
          span.textContent = prop.note
          row.appendChild(span)
        }
        propsBox.appendChild(row)
      })
      panel.appendChild(propsBox)
    }

    return panel
  }

  function memberHeading(text) {
    var h = document.createElement("h4")
    h.className = "mc-atlas-heading"
    h.textContent = text
    return h
  }

  function plateById(id) {
    return (data.plates || []).find(function (p) { return p.id === id }) || null
  }

  /* --- plate list ---------------------------------------------------------- */

  function renderPlates() {
    var plates = data.plates.slice().sort(function (a, b) { return a.page - b.page })
    var sel = el.select
    if (!sel) return

    // Keep the existing <select>; repopulate its options.
    sel.innerHTML = ""
    plates.forEach(function (p) {
      var opt = document.createElement("option")
      opt.value = p.id
      opt.textContent = labelOf(p)
      sel.appendChild(opt)
    })
    if (openPlateId) sel.value = openPlateId
  }

  /* --- viewer -------------------------------------------------------------- */

  function showPlate(plateId) {
    openPlateId = plateId
    var plate = plateById(plateId)
    // Drop into the viewer's slot; the custom element does the IIIF work.
    if (el.viewer && plate) {
      el.viewer.setAttribute("plate", JSON.stringify({ id: plate.id, label: labelOf(plate) }))
      if (el.plateTitle) el.plateTitle.textContent = labelOf(plate)
      if (el.plateLink) el.plateLink.href = "https://digital.shsmo.org/digital/collection/plat/id/" + encodeURIComponent(plate.id) + "/rec/1"
    }
    if (el.select && plate) el.select.value = plate.id
  }

  function openFamily(surname) {
    openSurname = surname
    renderFamilies()
    var open = el["atlas-families"].querySelector('.mc-atlas-family[data-surname="' + cssQuote(surname) + '"]')
    if (open) open.scrollIntoView({ block: "nearest" })
  }

  function cssQuote(value) {
    return window.CSS && CSS.escape ? CSS.escape(value) : value.replace(/["\\]/g, "\\$&")
  }

  /* --- wiring -------------------------------------------------------------- */

  function wire() {
    el["atlas-families"].addEventListener("click", function (event) {
      var btn = event.target.closest ? event.target.closest(".mc-atlas-family-btn") : null
      if (btn) {
        var surname = btn.closest(".mc-atlas-family").dataset.surname
        openFamily(surname === openSurname ? null : surname)
        return
      }
      var view = event.target.closest ? event.target.closest(".mc-atlas-property-view") : null
      if (view) {
        showPlate(view.dataset.plateId)
      }
    })

    if (el.clear) {
      el.clear.addEventListener("click", function () {
        openFamily(null)
      })
    }

    if (el.select) {
      el.select.addEventListener("change", function () { showPlate(el.select.value) })
    }

    // Follow the burial ledger's "buried with" into the family browser if asked.
    window.addEventListener("hashchange", fromAddress)
  }

  function fromAddress() {
    var match = /^#atlas\/(.+)$/.exec(location.hash || "")
    if (!match || !data) return
    try {
      openSurname = decodeURIComponent(match[1])
      renderFamilies()
      openFamily(openSurname)
    } catch (err) { /* ignore malformed hash */ }
  }

  /* --- boot ---------------------------------------------------------------- */

  function start() {
    grab()
    if (!el["atlas-families"]) return
    Promise.all([
      fetch(dataUrl("atlas.json"), { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : Promise.reject(new Error(String(r.status))) }),
      fetch(dataUrl("burials.json"), { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : Promise.reject(new Error(String(r.status))) })
    ]).then(function (results) {
      data = results[0]
      burials = results[1]
      renderFamilies()
      renderPlates()
      if (data.plates && data.plates.length) showPlate(data.plates[0].id)
      wire()
      fromAddress()
      var section = document.getElementById("mc-atlas")
      if (section) section.hidden = false
    }).catch(function () {
      var section = document.getElementById("mc-atlas")
      if (section) section.hidden = true
    })
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start)
  } else {
    start()
  }
})()
