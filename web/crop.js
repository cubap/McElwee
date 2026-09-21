/*
 * The one crop the exhibit needs, shared by the burial index proof bench and the
 * specimen sheet's provenance trace.
 *
 * Rectangles are measured in the page's own pixel space, and the page photographs are
 * held at that size, so the crop is drawn at source resolution: the image is rotated
 * back by the page's skew around the line's center, then the line plus a small margin
 * is cut out. The full page stays one click away.
 *
 * page: { image, width, height } - width/height are the page's own pixel space; when
 * they are absent the image's natural size is used.
 * rect: { x0, y0, x1, y1, skew } - in page pixel space.
 * done(dataUrl | null): called once, with a JPEG data URL of the crop, or null when
 * the image cannot be loaded.
 */
(function (global) {
    "use strict"

    global.mcCropImage = function (page, rect, done) {
        var img = new Image()
        img.crossOrigin = "anonymous"
        img.onload = function () {
            var w = page.width || img.naturalWidth
            var h = page.height || img.naturalHeight
            var scale = img.naturalWidth / w
            var rad = (Number(rect.skew) || 0) * Math.PI / 180
            var rw = rect.x1 - rect.x0
            var rh = rect.y1 - rect.y0
            var margin = Math.max(4, Math.min(10, Math.min(rw, rh) * 0.2))
            var cx = (rect.x0 + rect.x1) / 2
            var cy = (rect.y0 + rect.y1) / 2
            var bx0 = Math.max(0, cx - rw / 2 - margin)
            var by0 = Math.max(0, cy - rh / 2 - margin)
            var bx1 = Math.min(w, cx + rw / 2 + margin)
            var by1 = Math.min(h, cy + rh / 2 + margin)
            var canvas = document.createElement("canvas")
            canvas.width = Math.max(1, Math.round((bx1 - bx0) * scale))
            canvas.height = Math.max(1, Math.round((by1 - by0) * scale))
            var ctx = canvas.getContext("2d")
            var ccx = (bx0 + bx1) / 2
            var ccy = (by0 + by1) / 2
            ctx.translate(canvas.width / 2, canvas.height / 2)
            ctx.rotate(-rad)
            ctx.drawImage(img, -ccx * scale, -ccy * scale, w * scale, h * scale)
            done(canvas.toDataURL("image/jpeg", 0.92))
        }
        img.onerror = function () { done(null) }
        img.src = page.image
    }
})(window)
