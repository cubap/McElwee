/**
 * @module Data Encoding and Exhibition for RERUM (DEER)
 * @author Patrick Cuba <cubap@slu.edu>
 * This code should serve as a basis for developers wishing to
 * use TinyThings as a RERUM proxy for an application for data entry,
 * especially within the Eventities model.
 * @see tiny.rerum.io
 */
class Deer {
    constructor(collectionURL) {
        this.collectionURL = collectionURL
        this.collection = localStorage.getItem(collectionURL) || {
            "@context": "",
            "@type": "List",
            "label": "List of Entities",
            "resources": [],
            "__rerum": {
                "alpha": "true",
                "APIversion": "0.8.0",
                "createdAt": Date.now(),
                "isOverwritten": "",
                "isReleased": "",
                "history": {
                    "next": [],
                    "previous": "",
                    "prime": "root"
                },
                "releases": {
                    "next": [],
                    "previous": "",
                    "replaces": ""
                },
                "generatedBy": "DEER tool"
            },
            "@id": collectionURL        
        }
        this.resources = []
        if(!localStorage.getItem("CURRENT_LIST_ID")) {
            localStorage.setItem("CURRENT_LIST_ID",collectionURL)
        }
        this.default = {
            context: "https:schema.org",
            type: "Thing",
            name: "new Entity"
        }
    }
    create(obj) {
        let mint = {
            "@context": this.default.context,
            "@type": this.default.type,
            "name":this.default.name
        }
    }
    getValue(property) {
        // TODO: There must be a best way to do this...
        if (!Array.isArray(property)) {
            property = [property]
        }
        for(p of property) {
            //get value, organize complicatedly.
        }
    }
}

export default Deer