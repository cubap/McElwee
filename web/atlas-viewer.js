/**
 * <mc-atlas-viewer> — a lightweight IIIF plat-map viewer.
 *
 * Renders one SHSMO plat plate as a pannable, zoomable image built from the IIIF Image
 * API. It deliberately does not pull in a tile client library: the exhibit is a static
 * site, the plate is a single high-resolution scan, and the requirement is "see the plat
 * on the site and credit and link back", which a light wrapper around the IIIF image
 * endpoint satisfies without shipping a framework.
 *
 * Responsibility split:
 *   - this element owns the viewport: pan, zoom, reset, and the image requests.
 *   - web/atlas.js owns the data and the family browser.
 *
 * Attribution is a requirement, not a nicety. The element always renders a credit line
 * naming the State Historical Society of Missouri and a link to the digitized collection,
 * and it refuses to render if it cannot attribute.
 *
 * The element reads its plate from the `plate` attribute, either a bare id ("3594") or an
 * object with { id, label } after JSON.parse. It builds IIIF urls from window.McElweeConfig
 * (or an intrinsic default) so the base URL stays in config.js like everything else.
 */

(function () {
  "use strict"

  const ATLAS_URL = "data/atlas.json"

  // The viewer ships no image of its own; the IIIF base is the only place the plate can
  // come from. This default matches the SHSMO endpoint and can be overridden via config.
  const DEFAULT_IIIF = "https://digital.shsmo.org/digital/iiif/plat"

  function esc(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
  }

  function iiifBase() {
    const cfg = window.McElweeConfig
    return (cfg && cfg.ATLAS_IIIF_BASE) || DEFAULT_IIIF
  }

  /**
   * A IIIF image url for the plate at a width, anchored at 0,0. Region, size, rotation and
   * format follow the IIIF Image API 2.0 path syntax used by CONTENTdm.
   */
  function imageUrl(plateId, width) {
    const size = /^\d+$/.test(String(width)) ? width : "full"
    return `${iiifBase()}/${plateId}/full/${size}/0/default.jpg`
  }

  class McAtlasViewer extends HTMLElement {
    constructor() {
      super()
      // Shadow root keeps the viewer's internals out of the exhibit's stylesheet, so the
      // viewer can be a proper instrument (its own chrome) without borrowing the sheet's.
      this.attachShadow({ mode: "open" })
      this._plate = null
      this._scale = 1
      this._offset = { x: 0, y: 0 }
      this._naturalWidth = 0
      this._naturalHeight = 0
      this._dirty = false
      this._start = null
      this._zoom = null
    }

    static get observedAttributes() {
      return ["plate"]
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (name === "plate" && newValue && newValue !== oldValue) {
        try {
          const parsed = JSON.parse(newValue)
          this._plate = parsed && typeof parsed === "object" ? parsed : { id: parsed }
        } catch (err) {
          this._plate = { id: newValue.trim() }
        }
        this.render()
      }
    }

    connectedCallback() {
      this.render()
    }

    /**
     * The credit is drawn once the plate is known and it must exist before the image is
     * requested; a plate with no attribution is not shown.
     */
    render() {
      const plate = this._plate
      if (!plate || !plate.id) {
        this.shadowRoot.innerHTML = `<div class="atlas-empty">No plate selected.</div>`
        return
      }

      const width = this._naturalWidth || 1400
      const src = imageUrl(plate.id, width)

      this.shadowRoot.innerHTML = `
        <style>
          :host { display: block; }
          .atlas { margin: 0; }
          .atlas-viewport {
            position: relative;
            overflow: hidden;
            width: 100%;
            height: min(78vh, 48rem);
            background: var(--sheet, #f5f6f2);
            border: 1px solid var(--rule, #b6bfb2);
            cursor: grab;
            touch-action: none;
          }
          .atlas-viewport:active { cursor: grabbing; }
          .atlas-viewport:focus-visible { outline: 2px solid var(--green, #1d5a3c); outline-offset: -2px; }
          .atlas-img {
            position: absolute;
            top: 0; left: 0;
            transform-origin: 0 0;
            transition: transform .12s ease-out;
            user-select: none;
            -webkit-user-drag: none;
            image-rendering: auto;
            pointer-events: none;
          }
          .atlas-controls {
            position: absolute;
            top: .5rem; right: .5rem;
            display: flex;
            flex-direction: column;
            gap: .25rem;
          }
          .atlas-controls button {
            width: 2.2rem; height: 2.2rem;
            font-family: var(--f-stamp, Courier New, monospace);
            font-size: 1.1rem;
            line-height: 1;
            background: var(--sheet, #f5f6f2);
            color: var(--ink, #161916);
            border: 1px solid var(--rule, #b6bfb2);
            cursor: pointer;
          }
          .atlas-controls button:hover { background: var(--sheet-edge, #e9ebe4); }
          .atlas-controls button:focus-visible { outline: 2px solid var(--green, #1d5a3c); }
          .atlas-reset { font-size: .7rem; letter-spacing: .08em; text-transform: uppercase; font-family: var(--f-label, sans-serif); }
          .atlas-credit {
            display: flex;
            flex-wrap: wrap;
            gap: .35rem .75rem;
            align-items: baseline;
            padding: .35rem .35rem 0;
            font-family: var(--f-label, sans-serif);
          }
          .atlas-credit-text {
            font-size: .7rem;
            letter-spacing: .1em;
            text-transform: uppercase;
            color: var(--ink-soft, #464d46);
          }
          .atlas-credit-link {
            font-size: .7rem;
            letter-spacing: .04em;
            color: var(--green, #1d5a3c);
            text-decoration: none;
          }
          .atlas-credit-link:hover { text-decoration: underline; }
          .atlas-empty {
            padding: 1rem;
            font-family: var(--f-label, sans-serif);
            font-size: .72rem;
            letter-spacing: .12em;
            text-transform: uppercase;
            color: var(--ink-faint, #79817a);
          }
        </style>
        <figure class="atlas">
          <div class="atlas-viewport" tabindex="0" role="img"
               aria-label="Plat map ${esc(plate.label || plate.id)}. Pan with the mouse; use + and - to zoom.">
            <img class="atlas-img" src="${esc(src)}" alt="Plat map ${esc(plate.label || plate.id)}">
            <div class="atlas-controls" aria-hidden="true">
              <button type="button" class="atlas-zoom atlas-zoom--in" title="Zoom in">+</button>
              <button type="button" class="atlas-zoom atlas-zoom--out" title="Zoom out">&minus;</button>
              <button type="button" class="atlas-reset" title="Reset view">Reset</button>
            </div>
          </div>
          <figcaption class="atlas-credit">
            <span class="atlas-credit-text">${esc(plate.label || "Plat map")}</span>
            <a class="atlas-credit-link" href="https://digital.shsmo.org/digital/collection/plat/id/${esc(plate.id)}/rec/1" target="_blank" rel="noopener">
              Digitized by the State Historical Society of Missouri
            </a>
          </figcaption>
        </figure>
      `

      const img = this.shadowRoot.querySelector(".atlas-img")
      const viewport = this.shadowRoot.querySelector(".atlas-viewport")

      img.addEventListener("load", () => {
        this._naturalWidth = img.naturalWidth
        this._naturalHeight = img.naturalHeight
        // Re-request at the display size once the intrinsic size is known.
        if (this._dirty) {
          this._dirty = false
          img.src = imageUrl(plate.id, width)
        }
        // Lay the image out at its own dimensions and scale the whole thing to fit the
        // viewport, so a 4,000px scan starts as a full map rather than a corner.
        this._fit(viewport)
      })

      viewport.addEventListener("wheel", (e) => this._onWheel(e, viewport), { passive: false })
      viewport.addEventListener("pointerdown", (e) => this._onPointerDown(e, viewport))
      this.shadowRoot.querySelector(".atlas-zoom--in").addEventListener("click", () => this._zoomBy(1.5, viewport))
      this.shadowRoot.querySelector(".atlas-zoom--out").addEventListener("click", () => this._zoomBy(0.67, viewport))
      this.shadowRoot.querySelector(".atlas-reset").addEventListener("click", () => this._reset(viewport))
      viewport.addEventListener("keydown", (e) => this._onKey(e, viewport))
    }

    /**
     * Fit the image within the viewport and centre it. The image is laid out at its natural
     * pixel size (so zoom math stays in image pixels) and then scaled to contain the box.
     */
    _fit(viewport) {
      const img = this.shadowRoot.querySelector(".atlas-img")
      if (!img) return
      const w = this._naturalWidth || img.naturalWidth
      const h = this._naturalHeight || img.naturalHeight
      if (!w || !h) return
      img.style.width = w + "px"
      img.style.height = h + "px"
      const box = viewport.getBoundingClientRect()
      const fit = Math.min(box.width / w, box.height / h)
      this._scale = fit
      this._offset = {
        x: (box.width - w * fit) / 2,
        y: (box.height - h * fit) / 2
      }
      this._apply(viewport)
    }

    _onWheel(e, viewport) {
      e.preventDefault()
      const factor = e.deltaY < 0 ? 1.1 : 0.9
      this._zoomAt(e.clientX - viewport.getBoundingClientRect().left,
        e.clientY - viewport.getBoundingClientRect().top, factor, viewport)
    }

    _onPointerDown(e, viewport) {
      e.preventDefault()
      this._start = {
        x: e.clientX,
        y: e.clientY,
        ox: this._offset.x,
        oy: this._offset.y
      }
      viewport.setPointerCapture(e.pointerId)
      viewport.addEventListener("pointermove", this._onMove = (ev) => {
        this._offset.x = this._start.ox + (ev.clientX - this._start.x)
        this._offset.y = this._start.oy + (ev.clientY - this._start.y)
        this._apply(viewport)
      })
      viewport.addEventListener("pointerup", () => {
        viewport.removeEventListener("pointermove", this._onMove)
        this._start = null
      })
    }

    _onKey(e, viewport) {
      if (e.key === "+" || e.key === "=") { e.preventDefault(); this._zoomBy(1.25, viewport) }
      else if (e.key === "-") { e.preventDefault(); this._zoomBy(0.8, viewport) }
      else if (e.key === "0") { e.preventDefault(); this._reset(viewport) }
    }

    _zoomBy(factor, viewport) {
      const rect = viewport.getBoundingClientRect()
      this._zoomAt(rect.width / 2, rect.height / 2, factor, viewport)
    }

    _zoomAt(cx, cy, factor, viewport) {
      const next = Math.min(8, Math.max(0.5, this._scale * factor))
      if (next === this._scale) return
      const ratio = next / this._scale
      this._offset.x = cx - (cx - this._offset.x) * ratio
      this._offset.y = cy - (cy - this._offset.y) * ratio
      this._scale = next
      this._apply(viewport)
    }

    _reset(viewport) {
      this._fit(viewport)
    }

    _apply(viewport) {
      const img = this.shadowRoot.querySelector(".atlas-img")
      if (!img) return
      const w = img.naturalWidth || this._naturalWidth || 1400
      img.style.transform = `translate(${this._offset.x}px, ${this._offset.y}px) scale(${this._scale})`
      // Keep the image within a sane margin so panning can't throw it off the viewport.
      viewport.classList.toggle("atlas-viewport--moved", this._offset.x !== 0 || this._offset.y !== 0 || this._scale !== 1)
    }
  }

  if (!customElements.get("mc-atlas-viewer")) {
    customElements.define("mc-atlas-viewer", McAtlasViewer)
  }
})()
