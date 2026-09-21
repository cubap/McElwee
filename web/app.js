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
mc.roster = document.getElementById("mc-roster")
mc.dividers = document.getElementById("mc-dividers")
mc.counts = document.getElementById("mc-counts")

// The exhibit's own vocabulary for the properties the catalog uses. Anything the store
// asserts that is not listed here is still shown, under "Other assertions": hiding an
// unexpected claim would be exactly the thing this exhibit is arguing against.
const FIELDS = [
    { key: "givenName", label: "Given name" },
    { key: "middleInitials", label: "Middle initials" },
    { key: "familyName", label: "Family name" },
    { key: "name", label: "Name as catalogued" },
    { key: "birthDate", label: "Born" },
    { key: "deathDate", label: "Died" },
    { key: "gender", label: "Sex" },
    { key: "description", label: "Marker inscription" },
    { key: "relationship", label: "Relationship" },
    { key: "plot", label: "Plot" },
    { key: "section", label: "Section" },
    { key: "marker", label: "Marker" },
    { key: "seeAlso", label: "See also" }
]
const FIELD_LABELS = {}
FIELDS.forEach(f => FIELD_LABELS[f.key] = f.label)
// A grave marker's photograph is somebody else's work. The exhibit links to it and
// attributes it rather than copying it, which also keeps a joke file that once got
// uploaded to the store from being mounted on a dead child's sheet.
const LINKED_ONLY = ["depiction"]

const LAST_SEEN_KEY = "mc:lastSeen"

mc.focusOn = function(id) {
    const normalized = CFG.normalizeId(id)
    try { localStorage.setItem(LAST_SEEN_KEY, normalized) } catch (err) { /* private mode */ }
    // A specimen sheet is citable: the address is the record.
    if (normalized) {
        history.replaceState(null, "", "#specimen/" + encodeURIComponent(normalized))
    }
    if (normalized === CFG.normalizeId(mc.focusObject.getAttribute("mc-object"))) {
        markCurrent()
        observerCallback([{ attributeName: "mc-object" }])
        return
    }
    mc.focusObject.setAttribute("mc-object", normalized)
    markCurrent()
}

function readCache(id) {
    try {
        return JSON.parse(localStorage.getItem(CFG.normalizeId(id)))
    } catch (err) {
        return null
    }
}

function writeCache(obj) {
    const id = recordId(obj)
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

/**
 * Every assertion the store makes about a record, kept separate instead of flattened.
 *
 * The old expand() collapsed duplicate properties onto the record and kept whichever
 * annotation arrived last, so four different spellings of one child's given name
 * rendered as a single confident value. Here each property accumulates its claims, and
 * the sheet prints the disagreements. obj[key] still holds the chosen value so the rest
 * of the app keeps working.
 */
async function expand(obj) {
    let findId = recordId(obj)
    let annos = await findByTargetId(findId)
    let claims = {}

    function record(key, value, anno, evidence, provenance) {
        if (!claims[key]) claims[key] = []
        let text = value === null || value === undefined ? "" : String(value)
        let existing = claims[key].find(c => c.value === text)
        if (existing) {
            existing.count++
            return
        }
        claims[key].push({
            key: key,
            value: text,
            count: 1,
            source: recordId(anno),
            evidence: evidence,
            provenance: provenance || null,
            generatedBy: anno && anno.__rerum && anno.__rerum.generatedBy,
            motivation: anno && anno.motivation,
            createdAt: anno && anno.__rerum && anno.__rerum.createdAt,
            superseded: !!(anno && anno.__rerum && anno.__rerum.history &&
                (anno.__rerum.history.next || []).length)
        })
    }

    for (let i = 0; i < annos.length; i++) {
        let body = annos[i].body
        if (!Array.isArray(body)) {
            body = [body]
        }
        for (let j = 0; j < body.length; j++) {
            let entry = body[j]
            if (!entry || typeof entry !== "object") continue
            if (entry.evidence && Object.keys(entry).length === 1) {
                let evId = (typeof entry.evidence === "object") ? recordId(entry.evidence) : entry.evidence
                try { obj.evidence = await get(evId) } catch (err) { obj.evidence = { "@id": evId } }
                continue
            }
            for (let k of Object.keys(entry)) {
                if (k.charAt(0) === "@" || k === "evidence" || k === "source" || k === "provenance") continue
                let raw = entry[k]
                // A falsy value is still a value. `raw.value || raw` used to render the
                // number 0 and the empty string as "[object Object]" (issue #9).
                let value = (raw && typeof raw === "object") ? ("value" in raw ? raw.value : raw) : raw
                if (value && typeof value === "object") value = JSON.stringify(value)
                let evidence = (raw && typeof raw === "object" && raw.evidence)
                    ? ((typeof raw.evidence === "object") ? recordId(raw.evidence) : raw.evidence)
                    : null
                let provenance = (raw && typeof raw === "object" && raw.provenance) ? raw.provenance : null
                record(k, value, annos[i], evidence, provenance)
            }
        }
    }

    obj.__claims = claims
    Object.keys(claims).forEach(function(k) {
        let chosen = pick(claims[k])
        obj[k] = { value: chosen.value, source: chosen.source, evidence: chosen.evidence }
    })
    return obj
}

/**
 * Which claim the sheet leads with when the records disagree.
 *
 * Newest-first was the obvious rule and it is the wrong one here: the most recent
 * assertions about this child are practice keystrokes, so the sheet opened with
 * "BLANDD, CLAUDIUS" on a one-year-old's grave. The exhibit therefore shows the value the
 * records assert most often, breaks ties toward the more recent claim, and says so on the
 * line. It is a stated convention, not a verdict, and every other value stays one press
 * away.
 */
function pick(list) {
    let filled = list.filter(c => String(c.value).trim() !== "")
    let pool = filled.length ? filled : list
    return pool.slice().sort(function(a, b) {
        if (b.count !== a.count) return b.count - a.count
        return timeOf(b) - timeOf(a)
    })[0]
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
        // RERUM answers /query with a bare `id` and keeps `@id` for GET by id. Keying the
        // dedupe on @id alone drops every annotation and empties the sheet, which is the
        // exact failure idVariants() exists to prevent, so accept either spelling.
        let matchId = recordId(match)
        if (!matchId || seen[matchId]) return
        seen[matchId] = true
        matches.push(match)
    })
    let local_matches = everything.filter(o => o && CFG.normalizeId(o.target) === canonical)
    return local_matches.concat(matches)
}

/* --- markup --------------------------------------------------------------- */

var template = {}

function esc(text) {
    return String(text === null || text === undefined ? "" : text)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
}

/**
 * The catalog was typed on a machine that wrote 0x14 where an em dash belongs, and the
 * store has kept it that way since 2018 (issue #8). Repair the control characters on the
 * way to the screen; leave the record alone.
 */
function clean(text) {
    return String(text || "")
        .replace(/[\u0014\u2014]/g, "\u2014")
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
        .trim()
}

function humanize(key) {
    if (FIELD_LABELS[key]) return FIELD_LABELS[key]
    return key.replace(/([A-Z])/g, " $1").replace(/^./, c => c.toUpperCase()).trim()
}

/**
 * The identifier of a record, whichever way RERUM chose to spell it in this response.
 */
function recordId(obj) {
    if (!obj) return null
    return CFG.normalizeId(obj["@id"] || obj.id) || null
}

function shortId(id) {
    if (!id) return ""
    let text = String(CFG.normalizeId(id))
    let tail = text.split("/").pop()
    return tail.length > 12 ? tail.slice(0, 12) + "\u2026" : tail
}

function storeUrl(id) {
    if (!id) return null
    let text = String(CFG.normalizeId(id))
    return /^https?:\/\//.test(text) ? text : null
}

/**
 * The store stamps every record with an ISO 8601 creation time; older records
 * may carry epoch milliseconds instead. Both are read as a comparable number.
 */
function timeOf(anno) {
    if (!anno || !anno.createdAt) return 0
    let t = Date.parse(anno.createdAt)
    if (isNaN(t)) t = Number(anno.createdAt)
    return isNaN(t) ? 0 : t
}

function dateOf(anno) {
    if (!anno.createdAt) return "date not recorded"
    let text = String(anno.createdAt)
    if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10)
    let d = new Date(Number(text))
    if (isNaN(d.getTime())) return "date not recorded"
    return d.toISOString().slice(0, 10)
}

template.evidence = function(obj) {
    try {
        let evidenceId = CFG.normalizeId((typeof obj.evidence === "object") ? recordId(obj.evidence) : obj.evidence)
        if (!evidenceId) return null
        return `<a class="mc-evidence" href="${esc(evidenceId)}" target="_blank" rel="noopener">${esc((obj.evidence && obj.evidence.label) || "View evidence")}</a>`
    } catch (err) {
        return null
    }
}

/**
 * One line of the label. A line more than one record denies carries a seam mark and
 * opens into the competing values, each with the annotation that asserted it.
 */
template.claim = function(key, list) {
    let chosen = pick(list)
    let contested = list.length > 1
    let value = clean(chosen.value)
    let display = value === "" ? `<span class="mc-value--absent">asserted, but left blank</span>` : esc(value)
    let html = `<div class="mc-claim-row" data-key="${esc(key)}">`
    html += `<button class="mc-claim" type="button" aria-expanded="false">`
    html += `<span class="mc-field">${esc(humanize(key))}</span>`
    html += `<span class="mc-value${contested ? " mc-value--seamed" : ""}">${display}</span>`
    if (contested) {
        html += `<span class="mc-seam-mark">${list.length} variants</span>`
    } else {
        html += `<span class="mc-trace-mark">trace</span>`
    }
    html += `</button>`
    html += `<div class="mc-claim-detail" hidden></div>`
    html += `</div>`
    return html
}

template.claimDetail = function(key, list) {
    let chosen = pick(list)
    let html = ""
    if (list.length > 1) {
        html += `<div class="mc-variants">`
        list.slice().sort((a, b) => timeOf(b) - timeOf(a)).forEach(function(c) {
            let shown = c === chosen
            html += `<div><span class="mc-value${shown ? "" : " mc-value--absent"}">${esc(clean(c.value)) || "\u2014 left blank \u2014"}</span>`
            html += `<span${shown ? ` class="mc-shown"` : ""}>${shown ? `on the line \u00b7 asserted ${c.count}\u00d7` : `${c.count}\u00d7 \u00b7 ${dateOf(c)}`}</span></div>`
        })
        html += `</div>`
    }
    html += `<div class="mc-trace"><h3>Provenance of this line</h3><dl>`
    html += `<dt>Field</dt><dd>${esc(key)}</dd>`
    html += `<dt>Asserted by</dt><dd>${cite(chosen.source, null, "annotation", chosen.motivation)}</dd>`
    html += `<dt>Written by</dt><dd>${cite(chosen.generatedBy, "shared transcription agent, sandbox@rerum.io", "agent")}</dd>`
    html += `<dt>Written on</dt><dd>${esc(dateOf(chosen))}</dd>`
    if (chosen.evidence) html += `<dt>Evidence</dt><dd>${cite(chosen.evidence, "catalog page", "document")}</dd>`
    if (chosen.provenance && chosen.provenance.sourceImage && chosen.provenance.rect) {
        html += `<dt>Source</dt><dd>${sourceFigure(chosen.provenance)}</dd>`
    }
    if (chosen.superseded) html += `<dt>Status</dt><dd>superseded by a later revision</dd>`
    html += `</dl>`
    if (list.length > 1) {
        html += `<p class="mc-caveat">Where the records disagree the sheet leads with the value asserted
            most often, and the more recent claim wins a tie. That is a stated convention, not a verdict:
            nothing here has been checked against a county, church, or census record, and the exhibit
            cannot check it, because the catalog's compiler is unrecorded.</p>`
    } else {
        html += `<p class="mc-caveat">This is what the store says. The exhibit has not checked it against
            a county, church, or census record, and cannot: the catalog's compiler is unrecorded.</p>`
    }
    html += `</div>`
    return html
}

/**
 * The slice of the page a claim was read from, mounted beside the trace like the
 * burial index's proof bench. The crop is drawn at source resolution by crop.js;
 * the full page stays one click away.
 */
function sourceFigure(provenance) {
    let url = provenance.sourceImage
    let rect = provenance.rect
    let size = /source-image-pixels-(\d+)x(\d+)/.exec(rect.source || "")
    let dims = size ? ` data-width="${size[1]}" data-height="${size[2]}"` : ""
    return `<figure class="mc-source" data-image="${esc(url)}" data-rect="${esc(JSON.stringify(rect))}"${dims}>
        <div class="mc-source-frame"><img src="${esc(url)}" alt="The line on the page this claim was read from"></div>
        <figcaption>
            <a class="mc-source-full" href="${esc(url)}" target="_blank" rel="noopener">Open the full page</a>
            <span class="mc-source-cite">${esc(url)}</span>
        </figcaption>
    </figure>`
}

/**
 * After the trace is in the DOM, cut the source slice out of the page photograph.
 * The rect was measured in the page's own pixel space, so the page's dimensions
 * ride along in the rect's `source` label when the loader recorded them.
 */
function decorateSource(root) {
    Array.prototype.forEach.call(root.querySelectorAll(".mc-source"), function(fig) {
        if (fig.dataset.wired) return
        fig.dataset.wired = "1"
        let url = fig.dataset.image
        let rect = null
        try { rect = JSON.parse(fig.dataset.rect) } catch (err) { rect = null }
        if (!url || !rect) return
        let page = { image: url }
        if (fig.dataset.width) page.width = Number(fig.dataset.width)
        if (fig.dataset.height) page.height = Number(fig.dataset.height)
        let img = fig.querySelector("img")
        mcCropImage(page, rect, function(dataUrl) {
            img.src = dataUrl || url
        })
    })
}

/**
 * The marks worn by each kind of record in the provenance trace. Drawn in the
 * exhibit's line style: 16px grid, 1.5px stroke, currentColor, no fill, so the
 * chip's colour carries the kind and the mark carries the shape.
 */
const KIND_ICONS = {
    annotation: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 2.75h5.5L12.5 5.75v7.5H4z"/><path d="M9.5 2.75v3h3"/><path d="M6 8h4"/><path d="M6 10.5h3"/></svg>`,
    agent: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.5 2.5c-3 .3-5.7 2.2-7.2 5.1L4 10.5l2.9-1.3c2.9-1.5 4.8-4.2 5.1-7.2Z"/><path d="M5.2 8.8 7.2 10.8"/><path d="M4 12l3-3"/></svg>`,
    document: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 2.75h5.5L12.5 5.75v7.5H4z"/><path d="M9.5 2.75v3h3"/><path d="M6 8h4"/><path d="M6 10h4"/><path d="M6 12h3"/></svg>`
}

/**
 * A link in the provenance trace. The kind chip says what sort of record it is
 * (annotation, agent, document) so a reader can tell an assertion from its evidence
 * at a glance; the label is filled in from the store when the record has one.
 */
function cite(id, fallback, kind, hint) {
    let url = storeUrl(id)
    if (!url) return esc(fallback || id || "not recorded")
    let kindLabel = kind || "record"
    let hintAttr = hint ? ` data-hint="${esc(hint)}"` : ""
    let icon = KIND_ICONS[kindLabel] || ""
    return `<a class="mc-cite mc-cite--${esc(kindLabel)}" href="${esc(url)}" target="_blank" rel="noopener" title="${esc(kindLabel)} \u00b7 ${esc(url)}" data-kind="${esc(kindLabel)}" data-id="${esc(url)}"${hintAttr}>` +
        `<span class="mc-kind" role="img" aria-label="${esc(kindLabel)}">${icon}</span><span class="mc-cite-label">${esc(shortId(url))}</span></a>`
}

let labelCache = new Map()

/**
 * The human-readable name of a store record, fetched once and remembered. Annotations
 * carry no label of their own, so the trace uses their motivation instead.
 */
function labelFor(id) {
    let url = storeUrl(id)
    if (!url) return Promise.resolve(null)
    if (labelCache.has(url)) return labelCache.get(url)
    let promise = fetch(url)
        .then(r => r.ok ? r.json() : null)
        .then(obj => (obj && (obj.label || obj.name || obj.title)) || null)
        .catch(() => null)
    labelCache.set(url, promise)
    return promise
}

/**
 * After the trace is in the DOM, swap the truncated ids for the records' own labels.
 */
function decorateTrace(root) {
    Array.prototype.forEach.call(root.querySelectorAll(".mc-cite[data-kind]"), function(a) {
        let label = a.querySelector(".mc-cite-label")
        if (!label) return
        if (a.dataset.kind === "annotation" && a.dataset.hint) {
            label.textContent = a.dataset.hint
            return
        }
        labelFor(a.dataset.id).then(function(name) {
            if (!name) return
            label.textContent = name
            a.title = `${name} \u00b7 ${a.dataset.kind} \u00b7 ${a.dataset.id}`
        })
    })
}

/**
 * The image URLs a record carries, in any of the spellings the store has used:
 * image, depiction, thumbnail, contentUrl, or a url that is itself an image.
 * Annotation bodies are searched too, because the catalog's page scans and the
 * headstone photographs are asserted the same way every other value is.
 */
function imageUrls(obj) {
    let urls = []
    let seen = {}
    function push(value, mustBeImage) {
        if (!value) return
        if (typeof value === "object") value = value["@id"] || value.url || value.contentUrl || value.id
        if (typeof value !== "string" || !/^https?:\/\//.test(value)) return
        if (mustBeImage && !/\.(jpe?g|png|gif|webp|svg)(\?|#|$)/i.test(value)) return
        if (seen[value]) return
        seen[value] = true
        urls.push(value)
    }
    if (!obj) return urls
    ;["image", "depiction", "thumbnail", "contentUrl"].forEach(function(k) {
        let v = obj[k]
        if (Array.isArray(v)) v.forEach(x => push(x, false))
        else push(v, false)
    })
    push(obj.url, true)
    let body = obj.body
    let bodies = Array.isArray(body) ? body : (body && typeof body === "object" ? [body] : [])
    bodies.forEach(function(b) {
        ;["image", "depiction", "thumbnail", "contentUrl"].forEach(function(k) {
            let v = b[k]
            if (Array.isArray(v)) v.forEach(x => push(x, false))
            else push(v, false)
        })
        push(b.evidence, true)
    })
    return urls
}

let lightbox = null

function ensureLightbox() {
    if (lightbox) return lightbox
    lightbox = document.createElement("dialog")
    lightbox.id = "mc-lightbox"
    lightbox.className = "mc-lightbox"
    document.body.appendChild(lightbox)
    lightbox.addEventListener("click", function(event) {
        if (event.target === lightbox) lightbox.close()
    })
    return lightbox
}

/**
 * The evidence behind a claim, shown as a mounted image instead of a bare link.
 * The dialog holds every image the evidence record carries, each with a button
 * that opens the full image in a new tab, and the citation that goes with it.
 */
async function openEvidenceLightbox(evidenceId) {
    let url = storeUrl(evidenceId)
    let images = []
    let label = null
    if (url) {
        if (/\.(jpe?g|png|gif|webp|svg)(\?|#|$)/i.test(url)) {
            // The evidence itself is the photograph.
            images.push({ url: url, source: "headstone photograph" })
        } else {
            let record = null
            try { record = await get(url) } catch (err) { record = null }
            if (record) {
                label = record.label || record.name || record.title || null
                imageUrls(record).forEach(function(img) {
                    images.push({ url: img, source: label || shortId(url) })
                })
            }
        }
    }
    // A headstone photograph asserted as a depiction is the same image the
    // catalog may cite as evidence, so it belongs in the same lightbox.
    let person = mc.current
    if (person && person.__claims && person.__claims.depiction) {
        person.__claims.depiction.forEach(function(c) {
            let img = storeUrl(c.value) || (/^https?:\/\//.test(c.value) ? c.value : null)
            if (img) images.push({ url: img, source: "headstone photograph" })
        })
    }
    let seen = {}
    images = images.filter(function(img) {
        if (seen[img.url]) return false
        seen[img.url] = true
        return true
    })
    let box = ensureLightbox()
    let title = label || (url && /\.(jpe?g|png|gif|webp|svg)(\?|#|$)/i.test(url) ? "Headstone photograph" : shortId(url)) || "Evidence"
    let html = `<div class="mc-lightbox-head">
        <h2>${esc(title)}</h2>
        <button type="button" class="mc-lightbox-close" aria-label="Close">\u00d7</button>
    </div>`
    if (images.length) {
        html += `<div class="mc-lightbox-images">`
        images.forEach(function(img) {
            html += `<figure class="mc-lightbox-figure">
                <img src="${esc(img.url)}" alt="${esc(img.source)}" loading="lazy">
                <figcaption>
                    <a class="mc-lightbox-open" href="${esc(img.url)}" target="_blank" rel="noopener">Full image with citation in new tab</a>
                    <span class="mc-lightbox-cite">${esc(img.source)} \u00b7 ${esc(img.url)}</span>
                </figcaption>
            </figure>`
        })
        html += `</div>`
    } else {
        html += `<p class="mc-lightbox-empty">No image is held for this evidence yet. The catalog's page
            scans and the headstone photographs will appear here when they are added to the record.</p>`
    }
    if (url) {
        html += `<p class="mc-lightbox-foot"><a href="${esc(url)}" target="_blank" rel="noopener">Open the record itself</a></p>`
    }
    box.innerHTML = html
    box.querySelector(".mc-lightbox-close").addEventListener("click", function() { box.close() })
    box.showModal()
}

/**
 * The evidence link opens the lightbox instead of the record; the depiction
 * photograph opens the same lightbox, because it is the same image resource.
 */
function wireEvidence(root) {
    Array.prototype.forEach.call(root.querySelectorAll(".mc-cite--document"), function(a) {
        if (a.dataset.wired) return
        a.dataset.wired = "1"
        a.addEventListener("click", function(event) {
            event.preventDefault()
            openEvidenceLightbox(a.dataset.id)
        })
    })
    Array.prototype.forEach.call(root.querySelectorAll(".mc-depiction-link"), function(a) {
        if (a.dataset.wired) return
        a.dataset.wired = "1"
        a.addEventListener("click", function(event) {
            event.preventDefault()
            openEvidenceLightbox(a.dataset.id)
        })
    })
}

template.depiction = function(list) {
    let chosen = pick(list)
    let url = storeUrl(chosen.value) || (/^https?:\/\//.test(chosen.value) ? chosen.value : null)
    if (!url) {
        return `<figure class="mc-specimen"><div class="mc-mount-empty">No image mounted</div>
            <figcaption>The store asserts nothing about how this person looked.</figcaption></figure>`
    }
    let host = ""
    try { host = new URL(url).hostname.replace(/^www\./, "") } catch (err) { host = "elsewhere" }
    return `<figure class="mc-specimen">
        <div class="mc-mount-empty">Image held elsewhere</div>
        <figcaption>
            <a class="mc-depiction-link" href="${esc(url)}" target="_blank" rel="noopener" data-id="${esc(url)}">Open the asserted photograph on ${esc(host)}</a><br>
            Linked, not copied: the exhibit does not hold the rights to it, and the record that
            points here was written on ${esc(dateOf(chosen))}.
        </figcaption>
    </figure>`
}

template.location = async function() {
    let cemetery
    try {
        cemetery = await expand(await get("l001"))
    } catch (err) {
        return null
    }
    if (!cemetery) {
        return null
    }
    let tmpl = `<p class="mc-kicker">Locality</p>`
    tmpl += `<h1 class="mc-title">${esc(clean(cemetery.name && cemetery.name.value || cemetery.name || "McElwee Cemetery"))}</h1>`
    tmpl += `<p class="mc-dates">Pike County, Missouri, near Louisiana</p>`
    if (cemetery.seeAlso) {
        let link = clean((cemetery.seeAlso && cemetery.seeAlso.value) || cemetery.seeAlso)
        let feature = (String(link).match(/\/feature\/(\d+)/) || [])[1]
        let label = feature ? `U.S. Geological Survey GNIS feature ${feature}` : "Locality authority"
        tmpl += `<p class="mc-stamp mc-stamp--authority">&middot; ${esc(label)} &middot; <a href="${esc(link)}" target="_blank" rel="noopener">open the authority record</a></p>`
    }
    return tmpl
}

/**
 * The only relevant list is the list of residents.
 * https://schema.org/ItemList
 */
template.list = function(ItemList) {
    let items = (ItemList.itemListElement || []).map(item => {
        return {
            id: recordId(item),
            name: clean(item.name || item.label || "")
        }
    })
    mc.lastItems = items
    mc.renderRoster(items)
    return `<p class="mc-kicker">Drawer</p>
        <h2 class="mc-title">${esc(clean(ItemList.name || "Cemetery Population"))}</h2>
        <p class="mc-dates">${items.length} specimens catalogued</p>
        <hr class="mc-rule">
        <div class="mc-determination">
            <strong>What a specimen is</strong>
            Every entry in the drawer is one record in the store, and every line on its sheet is a
            separate assertion made by a separate annotation. Pick a name. Press a line. The exhibit
            will show you who wrote it, when, and whether anybody else wrote something different.
        </div>
        <p class="mc-note">
            The drawer is small on purpose. It is not a census of the ground \u2014 it is what one
            catalog happened to record, and the gaps are part of what is being shown.
        </p>`
}

template.person = async function(obj) {
    setClass("Person")
    let claims = obj.__claims || {}
    let known = FIELDS.filter(f => claims[f.key])
    let knownKeys = known.map(f => f.key)
    let extra = Object.keys(claims).filter(k => knownKeys.indexOf(k) === -1)

    let given = clean((obj.givenName && obj.givenName.value) || "")
    let family = clean((obj.familyName && obj.familyName.value) || "")
    let heading = family && given ? `${family}, ${given}` : (family || given || clean(obj.name && obj.name.value) || "Unidentified")
    let born = clean((obj.birthDate && obj.birthDate.value) || "")
    let died = clean((obj.deathDate && obj.deathDate.value) || "")
    let span = (born || died) ? `${born || "\u2014"} \u2013 ${died || "\u2014"}` : ""

    let elem = `<p class="mc-kicker">Specimen &middot; Person</p>`
    elem += `<h2 class="mc-title">${esc(heading)}</h2>`
    if (span) elem += `<p class="mc-dates">${esc(span)}</p>`
    elem += `<p class="mc-stamp">Accession ${esc(shortId(obj["@id"]))}</p>`
    elem += `<hr class="mc-rule">`

    let catalog = known.filter(f => LINKED_ONLY.indexOf(f.key) === -1)
    let stray = extra.filter(k => LINKED_ONLY.indexOf(k) === -1)
    let contestedCount = 0
    if (catalog.length) {
        elem += `<div class="mc-claims">`
        catalog.forEach(function(f) {
            if ((claims[f.key] || []).length > 1) contestedCount++
            elem += template.claim(f.key, claims[f.key])
        })
        elem += `</div>`
    } else {
        elem += `<div class="mc-mount-empty">No assertions returned</div>`
    }

    if (claims.depiction) elem += template.depiction(claims.depiction)
    if (stray.length) elem += template.stray(stray, claims)

    mc.setCounts(catalog.length, contestedCount)
    return elem
}

/**
 * The store holds keys that were never part of the catalog's vocabulary \u2014 keystrokes
 * left behind by whoever was exercising the 2018 entry form. They are real records, so the
 * exhibit does not hide them, but they must never read as a determination about a person.
 */
template.stray = function(keys, claims) {
    let html = `<div class="mc-stray">`
    html += `<h3 class="mc-stray-head">Stray fields in the record</h3>`
    html += `<p class="mc-stray-note">These keys are not part of the catalog's vocabulary. They were
        written into the store alongside the real ones, most likely while the 2018 entry form was being
        tested. They are reproduced because the exhibit does not delete records it did not make, and
        they are kept off the label proper because they say nothing about this person.</p>`
    html += `<div class="mc-claims mc-claims--stray">`
    keys.forEach(k => html += template.claim(k, claims[k]))
    html += `</div></div>`
    return html
}

template.event = async function(obj) {
    setClass("Event")
    let claims = obj.__claims || {}
    let elem = `<p class="mc-kicker">Specimen &middot; Event</p>`
    elem += `<h2 class="mc-title">${esc(clean(obj.name && obj.name.value || obj.name || "Untitled event"))}</h2>`
    elem += `<hr class="mc-rule"><div class="mc-claims">`
    let n = 0
    Object.keys(claims).forEach(function(k) {
        if (k === "name") return
        n++
        elem += template.claim(k, claims[k])
    })
    elem += `</div>`
    mc.setCounts(n, 0)
    return elem
}

template.thing = async function(obj) {
    setClass("Thing")
    let claims = obj.__claims || {}
    let elem = `<p class="mc-kicker">Specimen &middot; Thing</p>`
    elem += `<h2 class="mc-title">${esc(clean(obj.name && obj.name.value || obj.name || "Untitled object"))}</h2>`
    elem += `<hr class="mc-rule"><div class="mc-claims">`
    let n = 0
    Object.keys(claims).forEach(function(k) {
        if (k === "name") return
        n++
        elem += template.claim(k, claims[k])
    })
    elem += `</div>`
    mc.setCounts(n, 0)
    return elem
}

template.byObjectType = async function(obj) {
    let templateFunction = function() {}
    let type = (Array.isArray(obj["@type"])) ? obj["@type"][0] : obj["@type"]
    switch (type) {
        case "Person":
            templateFunction = template.person
            break
        case "ItemList":
            templateFunction = template.list
            break
        case "Location":
            templateFunction = template.location
            break
        case "Event":
            templateFunction = template.event
            break
        default:
            templateFunction = template.thing
    }
    setClass(type)
    return templateFunction(obj)
}

template.JSON = function(obj) {
    try {
        let copy = Object.assign({}, obj)
        delete copy.__claims
        return `${JSON.stringify(copy, null, 4)}`
    } catch (err) {
        return null
    }
}

/* --- the drawer ----------------------------------------------------------- */

mc.renderRoster = function(items) {
    if (!mc.roster) return
    mc.roster.innerHTML = ""
    let surnames = {}
    items.forEach(function(item, i) {
        let surname = item.name.split(/\s+/).filter(Boolean).pop() || "Unassigned"
        surname = surname.replace(/[^A-Za-z'.-]/g, "") || "Unassigned"
        item.surname = surname
        surnames[surname] = (surnames[surname] || 0) + 1
        item.acc = String(i + 1).padStart(4, "0")
    })

    let keys = Object.keys(surnames).sort()
    if (mc.dividers) {
        mc.dividers.innerHTML = ""
        if (keys.length > 1) {
            mc.dividers.hidden = false
            mc.dividers.appendChild(dividerButton("All", null, items))
            keys.forEach(k => mc.dividers.appendChild(dividerButton(k, k, items)))
        } else {
            mc.dividers.hidden = true
        }
    }
    items.forEach(item => mc.roster.appendChild(rosterRow(item)))
    mc.rosterItems = items
    markLastSeen()
    markCurrent()
}

/**
 * The card for the sheet currently on the bench. Without it the drawer is a list with no
 * you-are-here, and the mobile rail hides the selection entirely.
 */
function markCurrent() {
    if (!mc.roster) return
    let focused = CFG.normalizeId(mc.focusObject.getAttribute("mc-object") || "")
    Array.prototype.forEach.call(mc.roster.querySelectorAll("button"), function(btn) {
        let id = CFG.normalizeId(btn.dataset.id || "")
        if (focused && id === focused) btn.setAttribute("aria-current", "true")
        else btn.removeAttribute("aria-current")
    })
}

function dividerButton(label, surname, items) {
    let btn = document.createElement("button")
    btn.type = "button"
    btn.className = "mc-divider"
    btn.textContent = surname ? `${label} (${items.filter(i => i.surname === surname).length})` : label
    btn.setAttribute("aria-pressed", surname ? "false" : "true")
    btn.addEventListener("click", function() {
        Array.prototype.forEach.call(mc.dividers.children, c => c.setAttribute("aria-pressed", "false"))
        btn.setAttribute("aria-pressed", "true")
        Array.prototype.forEach.call(mc.roster.children, function(row) {
            row.hidden = !!surname && row.dataset.surname !== surname
        })
    })
    return btn
}

function rosterRow(item) {
    let li = document.createElement("li")
    li.dataset.surname = item.surname
    let btn = document.createElement("button")
    btn.type = "button"
    btn.dataset.id = item.id
    btn.innerHTML = `<span class="mc-acc">${esc(item.acc)}</span><span class="mc-who">${esc(item.name || "unrecorded")}</span>`
    btn.addEventListener("click", () => mc.focusOn(item.id))
    li.appendChild(btn)
    return li
}

function markLastSeen() {
    let last = null
    try { last = localStorage.getItem(LAST_SEEN_KEY) } catch (err) { return }
    if (!last) return
    Array.prototype.forEach.call(mc.roster.querySelectorAll("button"), function(btn) {
        if (btn.dataset.id === last) btn.classList.add("mc-flagged")
    })
}

mc.setCounts = function(claims, contested) {
    if (!mc.counts) return
    let text = `${claims} properties on this sheet`
    if (contested) text += ` \u00b7 ${contested} contested`
    mc.counts.textContent = text
}

// Press a line, see the record behind it: the seam splays, the trace follows.
function wireClaims(root) {
    Array.prototype.forEach.call(root.querySelectorAll(".mc-claim"), function(btn) {
        btn.addEventListener("click", function() {
            let row = btn.parentNode
            let detail = row.querySelector(".mc-claim-detail")
            let open = btn.getAttribute("aria-expanded") === "true"
            btn.setAttribute("aria-expanded", open ? "false" : "true")
            detail.hidden = open
            if (open) return
            if (!detail.dataset.built) {
                let key = row.dataset.key
                let claims = (mc.current && mc.current.__claims && mc.current.__claims[key]) || []
                detail.innerHTML = template.claimDetail(key, claims)
                decorateTrace(detail)
                decorateSource(detail)
                wireEvidence(detail)
                detail.dataset.built = "1"
            }
            detail.classList.add("mc-claim-detail", "mc-open")
        })
    })
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
            mc.current = data
            await renderElement(mc.focusObject, template.byObjectType(data))
            markCurrent()
            wireClaims(mc.focusObject)
            wireEvidence(mc.focusObject)
            Array.prototype.forEach.call(mc.focusObject.querySelectorAll(".mc-claim-detail"), function(d) {
                d.classList.add("mc-claim-detail")
            })
            renderElement(document.getElementById("obj-viewer"), template.JSON(data))
            markLastSeen()
        }
    }
}

mc.renderObserver = new MutationObserver(observerCallback)
mc.renderObserver.observe(mc.focusObject, {
    attributes: true
})

// The drawer is keyboard-traversable the way a card index is.
if (mc.roster) {
    mc.roster.addEventListener("keydown", function(event) {
        if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return
        let rows = Array.prototype.filter.call(mc.roster.children, li => !li.hidden)
        let buttons = rows.map(li => li.querySelector("button"))
        let at = buttons.indexOf(document.activeElement)
        if (at === -1) return
        event.preventDefault()
        let next = buttons[at + (event.key === "ArrowDown" ? 1 : -1)]
        if (next) next.focus()
    })
}

(function wireRaw() {
    let toggle = document.getElementById("mc-raw-toggle")
    let viewer = document.getElementById("obj-viewer")
    if (!toggle || !viewer) return
    toggle.addEventListener("click", function() {
        let open = toggle.getAttribute("aria-expanded") === "true"
        toggle.setAttribute("aria-expanded", open ? "false" : "true")
        viewer.hidden = open
    })
})()

// load defaulty bits
renderElement(document.getElementById("mc-location"), template.location())

/**
 * The drawer index is the exhibit's table of contents, so it is built on every load and
 * not only when the list itself is the focused record. A visitor who arrives on one
 * child's sheet still has to be able to see who else is in the catalog.
 */
async function loadDrawer() {
    let listId = CFG.normalizeId(localStorage.getItem("CURRENT_LIST_ID")) || DEFAULT_LIST_ID
    try {
        let list = await get(listId)
        let items = (list.itemListElement || []).map(item => ({
            id: recordId(item),
            name: clean(item.name || item.label || "")
        })).filter(item => item.id)
        mc.renderRoster(items)
    } catch (err) {
        if (mc.roster) {
            mc.roster.innerHTML = `<li><span class="mc-empty">The drawer could not be read.</span></li>`
        }
    }
}

/**
 * Open on whatever the address asks for: a specimen, or the drawer. The exhibit is a
 * teaching object, so a teacher has to be able to send a student to one sheet.
 */
function startFromAddress() {
    let wanted = null
    let match = /^#specimen\/(.+)$/.exec(location.hash || "")
    if (match) {
        try { wanted = CFG.normalizeId(decodeURIComponent(match[1])) } catch (err) { wanted = null }
    }
    if (!wanted) {
        wanted = CFG.normalizeId(localStorage.getItem("CURRENT_LIST_ID")) || DEFAULT_LIST_ID
    }
    mc.focusObject.setAttribute("mc-object", wanted)
}
loadDrawer()
startFromAddress()
window.addEventListener("hashchange", startFromAddress)