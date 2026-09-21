/**
 * The burial index.
 *
 * Reads web/data/burials.json, which `npm run build` generates from the transcribed evidence
 * (scripts/build-burials.js). The claim keys here are the same ones the RERUM loader publishes,
 * so when the records move into the store this file changes where it reads from, not what it
 * renders.
 *
 * The one job that matters: a reader must be able to check us. Every line can be lifted back to
 * the exact rectangle of typescript it was read from, because the transcription kept those
 * coordinates and the page photographs are held locally.
 */

(function () {
    "use strict"

    var LABELS = {
        birthDate: "Born",
        deathDate: "Died",
        ageAtDeath: "Aged",
        relationship: "Relation",
        relatedTo: "Of"
    }

    // Claims that are shown by another part of the row, so the reduced line must not repeat them.
    var NOT_REDUCED = { description: 1, engravingText: 1, familyGroup: 1 }

    var HIDDEN = { "": 1 }

    var el = {}
    var data = null
    var open = null

    function esc(value) {
        return String(value === null || value === undefined ? "" : value)
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;").replace(/'/g, "&#39;")
    }

    function grab() {
        ;["mc-burials", "mc-burials-count", "mc-burials-dividers", "mc-burials-rows", "mc-burials-empty",
            "mc-burials-clear", "mc-proof", "mc-proof-title", "mc-proof-frame", "mc-proof-line", "mc-proof-credit", "mc-proof-close"]
            .forEach(function (id) { el[id.replace(/^mc-/, "")] = document.getElementById(id) })
    }

    function url() {
        return new URL("data/burials.json", document.baseURI).href
    }

    /* --- rows -------------------------------------------------------------- */

    function reduced(record) {
        return (record.claimList || []).filter(function (c) {
            return !NOT_REDUCED[c.key] && !HIDDEN[c.value]
        }).map(function (c) {
            return '<span><b>' + esc(LABELS[c.key] || c.key) + '</b> ' + esc(c.value) + '</span>'
        }).join("")
    }

    function rowNode(record) {
        var li = document.createElement("li")
        li.className = "mc-b" + (record.claims.familyGroup ? " mc-b--family" : "")
        li.dataset.surname = record.surname || ""
        li.dataset.id = record.id

        var name = ""
        if (record.surname) {
            name = '<span class="mc-b-surname">' + esc(record.surname) + '</span>'
        }
        if (record.givenName) {
            name += (name ? " " : "") + '<span class="mc-b-given">' + esc(record.givenName) + '</span>'
        }

        li.innerHTML =
            '<button type="button" class="mc-b-btn" aria-pressed="false" aria-controls="mc-proof" data-id="' + esc(record.id) + '" data-witness="index">' +
            (name ? '<span class="mc-b-name">' + name + '</span>' : "") +
            '<span class="mc-b-line">' + esc(record.claims.description || "(line not legible)") + '</span>' +
            (reduced(record) ? '<span class="mc-b-reduced">' + reduced(record) + '</span>' : "") +
            '</button>'

        // A second witness: the same person is also cut on a stone, photographed separately.
        // It is its own control rather than part of the row so the two readings can be
        // opened one after the other and compared.
        if (record.engraving && record.engraving.text) {
            var alt = document.createElement("button")
            alt.type = "button"
            alt.className = "mc-b-witness"
            alt.setAttribute("aria-pressed", "false")
            alt.setAttribute("aria-controls", "mc-proof")
            alt.dataset.id = record.id
            alt.dataset.witness = "engraving"
            alt.innerHTML = '<span class="mc-b-witness-mark">&#8258;</span> Also cut on a stone'
            li.appendChild(alt)
        }

        // The bracket in the margin means "buried with", but a mark that cannot be read
        // aloud is not information. Name the head of the group and go there.
        var group = record.claims.familyGroup
        if (group && group.headOf) {
            var kin = document.createElement("button")
            kin.type = "button"
            kin.className = "mc-b-kin"
            kin.dataset.id = group.headOf
            kin.dataset.witness = "index"
            kin.innerHTML = '<span class="mc-b-kin-mark">&#8627;</span> buried with ' + esc(headName(group))
            li.appendChild(kin)
        }
        return li
    }

    /**
     * The compiler stored these names as "given SURNAME", and sometimes the given name
     * already ended in the surname, so the index can read "Malcolm HENRY HENRY". Only the
     * display is tidied; the claim keeps the source text.
     */
    function headName(group) {
        var name = String(group.value || "").trim()
        return name.replace(/(\S+)(\s+\1)+$/g, "$1")
    }

    function render() {
        var frag = document.createDocumentFragment()
        data.records.forEach(function (record) { frag.appendChild(rowNode(record)) })
        el["burials-rows"].innerHTML = ""
        el["burials-rows"].appendChild(frag)
        el["burials-count"].textContent = data.count + (data.count === 1 ? " line" : " lines")
        renderDividers()
        el.burials.hidden = false
    }

    function renderDividers() {
        var seen = {}
        var names = []
        data.records.forEach(function (r) {
            var s = r.surname || "Unassigned"
            if (!seen[s]) { seen[s] = 1; names.push(s) }
        })
        names.sort(function (a, b) { return a.localeCompare(b, "en") })

        el["burials-dividers"].innerHTML = ""
        if (names.length < 2) { el["burials-dividers"].hidden = true; return }

        names.forEach(function (surname) {
            var btn = document.createElement("button")
            btn.type = "button"
            btn.textContent = surname
            btn.dataset.surname = surname
            btn.setAttribute("aria-pressed", "false")
            el["burials-dividers"].appendChild(btn)
        })
    }

    function filterTo(surname) {
        var rows = el["burials-rows"].children
        var shown = 0
        for (var i = 0; i < rows.length; i++) {
            var match = !surname || rows[i].dataset.surname === surname
            rows[i].hidden = !match
            if (match) shown++
        }
        var buttons = el["burials-dividers"].querySelectorAll("button")
        for (var j = 0; j < buttons.length; j++) {
            buttons[j].setAttribute("aria-pressed", String(Boolean(surname) && buttons[j].dataset.surname === surname))
        }
        el["burials-empty"].hidden = shown > 0
    }

    /* --- the proof bench --------------------------------------------------- */

    function pageOf(record) {
        return (data.pages || {})[record.page] || null
    }

    /**
     * Rectangles were measured in the page's own pixel space, so they are placed as a
     * percentage of it and stay put at whatever width the column settles at.
     */
    function boxStyle(rect, page) {
        var w = page.width || 600
        var h = page.height || 800
        var skew = Number(rect.skew) || 0
        return [
            "left:" + ((rect.x0 / w) * 100).toFixed(3) + "%",
            "top:" + ((rect.y0 / h) * 100).toFixed(3) + "%",
            "width:" + (((rect.x1 - rect.x0) / w) * 100).toFixed(3) + "%",
            "height:" + (((rect.y1 - rect.y0) / h) * 100).toFixed(3) + "%",
            "transform:rotate(" + (-skew).toFixed(2) + "deg)"
        ].join(";")
    }

    /**
     * The index and the stone are two separate photographs of the same claim. Which one the
     * bench shows depends on what was pressed, so the reader can flip between them.
     */
    function subject(record, witness) {
        if (witness === "engraving" && record.engraving) {
            return {
                page: (data.pages || {})[record.engraving.page] || null,
                rect: record.engraving.rect,
                line: record.engraving.text,
                caption: "Inscription " + record.engraving.page
            }
        }
        return {
            page: pageOf(record),
            rect: record.rect,
            line: record.claims.description,
            caption: "Index page " + record.page + ", line " + record.seq
        }
    }

    function showProof(record, witness) {
        var it = subject(record, witness)
        if (!it.page || !it.page.image) return false

        el.burials.classList.add("has-proof")
        el["proof-title"].textContent = it.caption
        el["proof-frame"].innerHTML =
            '<img src="' + esc(it.page.image) + '" alt="' + esc(it.caption) + '" loading="lazy">' +
            (it.rect
                ? '<span class="mc-proof-box" style="' + boxStyle(it.rect, it.page) + '"><span class="mc-proof-box-in"></span></span>'
                : "")
        el["proof-line"].textContent = it.line || ""
        el["proof-credit"].textContent = it.page.credit || "Photograph held with this exhibit."
        el.proof.hidden = false
        return true
    }

    function hideProof() {
        el.proof.hidden = true
        el["proof-frame"].innerHTML = ""
        el.burials.classList.remove("has-proof")
        clearPressed()
        open = null
    }

    function clearPressed() {
        var on = el["burials-rows"].querySelectorAll('[aria-pressed="true"]')
        for (var i = 0; i < on.length; i++) on[i].setAttribute("aria-pressed", "false")
    }

    function find(id) {
        for (var i = 0; i < data.records.length; i++) {
            if (data.records[i].id === id) return data.records[i]
        }
        return null
    }

    function select(id, witness, focusPanel) {
        var record = find(id)
        if (!record) return false

        var key = id + ":" + witness
        if (open === key) { hideProof(); return true }

        clearPressed()
        var btn = el["burials-rows"].querySelector('.mc-b [data-id="' + cssQuote(id) + '"][data-witness="' + witness + '"]')
        if (btn) btn.setAttribute("aria-pressed", "true")

        if (!showProof(record, witness)) { hideProof(); return false }
        open = key
        if (focusPanel) el.proof.focus()
        return true
    }

    function cssQuote(value) {
        return window.CSS && CSS.escape ? CSS.escape(value) : value.replace(/["\\]/g, "\\$&")
    }

    /* --- address ----------------------------------------------------------- */

    function burialInHash() {
        var match = /^#(burial|inscription)\/(.+)$/.exec(location.hash || "")
        if (!match) return null
        try {
            return {
                id: decodeURIComponent(match[2]),
                witness: match[1] === "inscription" ? "engraving" : "index"
            }
        } catch (err) { return null }
    }

    /**
     * Opening the bench adds a column, which reflows the rows and moves whatever was just
     * scrolled to. So the scroll is repeated once the photograph has settled, otherwise a
     * link to one burial lands near the right place and then drifts away from it.
     */
    function revealRow(row) {
        if (!row || !row.scrollIntoView) return
        row.scrollIntoView({ block: "center" })
        var img = el["proof-frame"].querySelector("img")
        if (img && !img.complete) {
            img.addEventListener("load", function () { row.scrollIntoView({ block: "center" }) }, { once: true })
        } else {
            requestAnimationFrame(function () { row.scrollIntoView({ block: "center" }) })
        }
    }

    function fromAddress() {
        var wanted = burialInHash()
        if (!wanted || !data) return
        if (!select(wanted.id, wanted.witness, false)) return
        revealRow(el["burials-rows"].querySelector('[data-id="' + cssQuote(wanted.id) + '"]'))
    }

    /* --- wiring ------------------------------------------------------------ */

    function wire() {
        el["burials-rows"].addEventListener("click", function (event) {
            var btn = event.target.closest ? event.target.closest("[data-witness]") : null
            if (!btn) return
            var narrow = window.matchMedia("(max-width: 72rem)").matches
            select(btn.dataset.id, btn.dataset.witness, narrow)
            // "buried with" is a pointer into the index, so follow it rather than only
            // opening the other line's proof.
            if (btn.classList.contains("mc-b-kin") && !narrow) {
                revealRow(el["burials-rows"].querySelector('[data-id="' + cssQuote(btn.dataset.id) + '"]'))
            }
        })

        el["burials-dividers"].addEventListener("click", function (event) {
            var btn = event.target.closest ? event.target.closest("button") : null
            if (!btn) return
            var same = btn.getAttribute("aria-pressed") === "true"
            filterTo(same ? "" : btn.dataset.surname)
        })

        el["burials-clear"].addEventListener("click", function () { filterTo("") })

        el["proof-close"].addEventListener("click", function () {
            var back = el["burials-rows"].querySelector('[aria-pressed="true"]')
            hideProof()
            if (back) back.focus()
        })

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape" && !el.proof.hidden) {
                var back = el["burials-rows"].querySelector('[aria-pressed="true"]')
                hideProof()
                if (back) back.focus()
            }
        })

        // Traversed the way the card drawer is: the list is an index, and an index is
        // walked with the arrow keys.
        el["burials-rows"].addEventListener("keydown", function (event) {
            if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return
            var rows = Array.prototype.filter.call(el["burials-rows"].children, function (li) { return !li.hidden })
            var buttons = rows.map(function (li) { return li.querySelector("button") })
            var at = buttons.indexOf(event.target)
            if (at === -1) return
            event.preventDefault()
            var next = buttons[at + (event.key === "ArrowDown" ? 1 : -1)]
            if (next) next.focus()
        })

        window.addEventListener("hashchange", fromAddress)
    }

    function start() {
        grab()
        if (!el.burials || !el["burials-rows"]) return
        fetch(url(), { cache: "no-cache" })
            .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error(String(r.status))) })
            .then(function (json) {
                if (!json || !json.records || !json.records.length) return
                data = json
                render()
                wire()
                fromAddress()
            })
            .catch(function () {
                // No published index is a normal state, not an error worth showing a
                // reader: the specimen sheet above still stands on its own.
                el.burials.hidden = true
            })
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start)
    } else {
        start()
    }
})()
