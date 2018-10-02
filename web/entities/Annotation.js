/**
 * @module Data Encoding and Exhibition for RERUM (DEER)
 * @author Patrick Cuba <cubap@slu.edu>
 * This code should serve as a basis for developers wishing to
 * use TinyThings as a RERUM proxy for an application for data entry,
 * especially within the Eventities model.
 * @see tiny.rerum.io
 */
class Annotation {
    constructor(target, options){
        this["@context"] = ""
        this["@type"] = "Annotation"
        this.motivation = "describing"
        this.target = target
        this.body = options.body || {}
    }

    setBody(body) {
        this.body = body
    }

    getRenderTemplate() {
        let elem = `<span>`
        let body = this.body
        if(!Array.isArray(body)){
            body = [body]
        }
        for(let val of this.body) {
            elem += `<span>${this.getValue(val)}</span>`
        }
        return elem += `</span>`
    }

    getEntryTemplate() {
        return ``
    }

    getValue(property, asType) {
        // TODO: There must be a best way to do this...
        let prop;
        if (!Array.isArray(property)) {
            prop = property.map(getValue)
        }
        if (typeof property === "object") {
            // TODO: JSON-LD insists on "@value", but this is simplified in a lot
            // of contexts. Reading that is ideal in the future.
            prop =
                p.hasOwnProperty("@value") && p["@value"] ||
                p.hasOwnProperty("value") && p["value"] ||
                p.hasOwnProperty("$value") && p["$value"] ||
                p.hasOwnProperty("val") && p["val"]
        } else {
            prop = property
        }
        try {
            switch (asType.toUpperCase()) {
                case "STRING":
                    prop = prop.toString();
                    break
                case "NUMBER":
                    prop = parseFloat(prop);
                    break
                case "INTEGER":
                    prop = parseInt(prop);
                    break
                case "BOOLEAN":
                    prop = !Boolean(["false", "no", "0", "", "undefined", "null"].indexOf(String(prop).toLowerCase().trim()));
                    break
                default:
            }
        } catch (err) {
            if (asType) {
                throw new Error("asType: '" + asType + "' is not possible.\n" + err.message)
            } else {
                // no casting requested
            }
        } finally {
            return prop
        }
    }

}

export { Annotation }