(function () {
    // hand-done data for McElwee
    // foaf, cidoc, bio not really preferenced yet...

    // The Entities
    let datar = {}
    datar.personCB = {
        "@context": "",
        "@id": "p001",
        "@type": "Person",
        "label": "Claud H. Bland"
    }
    datar.personJHB = {
        "@context": "",
        "@id": "p002",
        "@type": "Person",
        "label": "JH Bland"
    }
    datar.personJJB = {
        "@context": "",
        "@id": "p003",
        "@type": "Person",
        "label": "JJ Bland"
    }
    datar.personMLB = {
        "@context": "",
        "@id": "p004",
        "@type": "Person",
        "label": "Minnie Lee Bland"
    }
    datar.personSIHB = {
        "@context": "",
        "@id": "p005",
        "@type": "Person",
        "label": "Sarah I. Howell Bevard"
    }
    datar.personWB = {
        "@context": "",
        "@id": "p006",
        "@type": "Person",
        "label": "W.Brunaugh"
    }
    datar.personECC = {
        "@context": "",
        "@id": "p007",
        "@type": "Person",
        "label": "Elizabeth C. Carr"
    }
    datar.eventCBb = {
        "@context": "",
        "@id": "e001",
        "@type": "Event",
        "label": "Birth of Claud Bland"
    }
    datar.eventCBd = {
        "@context": "",
        "@id": "e002",
        "@type": "Event",
        "label": "Death of Claud Bland"
    }
    datar.itemMarker = {
        "@context": "",
        "@id": "t001",
        "@type": "Thing",
        "label": "Grave marker for Bland, Claud H."
    }
    datar.locationCemetery = {
        "@context": "",
        "@id": "l001",
        "@type": "Location",
        "label": "McElwee Cemetery"
    }
    datar.documentCatalog = {
        "@context": "",
        "@id": "http://devstore.rerum.io/v1/id/5b76fc0de4b09992fca21e68",
        "@type": "Document",
        "label": "McElwee Cemetery Catalog"
    }
    // datar.catalogList = {
    //     "@context": "",
    //     "@id": "http://devstore.rerum.io/v1/id/5b998c95e4b09992fca21fd0",
    //     "@type": "List",
    //     "label": "Cemetery Residents",
    //     "resources": [{ "@id": "p001", "label": "Claud H. Bland" },
    //         { "@id": "p004", "label": "Minnie Lee Bland" },
    //         { "@id": "p005", "label": "Sarah I. Howell Bevard" },
    //         { "@id": "p006", "label": "W. Brunaugh" },
    //         { "@id": "p007", "label": "Elizabeth C. Carr" }
    //     ]
    // }

    // // The Annotations
    // datar.annoP1 = {
    //     "@context": "",
    //     "@id": "anP1",
    //     "@type": "Annotation",
    //     "motivation": "describing",
    //     "target": "p001",
    //     "body": [
    //         { "givenName": "Claud" },
    //         { "familyName": "Bland" },
    //         { "gender": "male" },
    //         { "label": "Claud H. Bland" },
    //         { "name": "Claud H. Bland" },
    //         { "birthDate": "1882-03-25" },
    //         { "deathDate": "1883-12-12" },
    //         { "Birth": { "@id": "e001" } },
    //         { "Death": { "@id": "e002" } },
    //         { "evidence": { "@id": "http://devstore.rerum.io/v1/id/5b76fc0de4b09992fca21e68" } }
    //     ]
    // }
    // datar.annoP2 = {
    //     "@context": "",
    //     "@id": "anP2",
    //     "@type": "Annotation",
    //     "motivation": "describing",
    //     "target": "p002",
    //     "body": [
    //         { "label": "J. H. Bland" },
    //         { "givenName": "J." },
    //         { "familyName": "Bland" },
    //         { "name": "J. H. Bland" },
    //         { "evidence": { "@id": "http://devstore.rerum.io/v1/id/5b76fc0de4b09992fca21e68" } }
    //     ]
    // }
    // datar.annoP3 = {
    //     "@context": "",
    //     "@id": "anP3",
    //     "@type": "Annotation",
    //     "motivation": "describing",
    //     "target": "p003",
    //     "body": [
    //         { "label": "J. J. Bland" },
    //         { "givenName": "J." },
    //         { "familyName": "Bland" },
    //         { "name": "J. J. Bland" },
    //         { "evidence": { "@id": "http://devstore.rerum.io/v1/id/5b76fc0de4b09992fca21e68" } }
    //     ]
    // }
    datar.annoE1 = {
        "@context": "",
        "@id": "anE1",
        "@type": "Annotation",
        "motivation": "describing",
        "target": "e001",
        "body": [{
                "label": "The birth of Claud H. Bland"
            },
            {
                "principal": {
                    "@id": "p001"
                }
            },
            {
                "parent": {
                    "@id": "p002"
                }
            },
            {
                "parent": {
                    "@id": "p003"
                }
            },
            {
                "date": "1882-03-25"
            }
        ]
    }
    datar.annoE2 = {
        "@context": "",
        "@id": "anE2",
        "@type": "Annotation",
        "motivation": "describing",
        "target": "e002",
        "body": [{
                "label": "The death of Claud H. Bland"
            },
            {
                "principal": {
                    "@id": "p001"
                }
            },
            {
                "date": "1883-12-12"
            }
        ]
    }
    datar.annoT1 = {
        "@context": "",
        "@id": "anT1",
        "@type": "Annotation",
        "motivation": "describing",
        "target": "t001",
        "body": [{
                "seeAlso": "https://www.findagrave.com/memorial/5440149/claud-bland"
            },
            {
                "evidence": "https://images.findagrave.com/photos/2013/93/5440149_136510870831.jpg"
            }
        ]
    }
    datar.annoL1 = {
        "@context": "",
        "@id": "anL1",
        "@type": "Annotation",
        "motivation": "describing",
        "target": "l001",
        "body": [{
                "label": "McElwee Cemetery"
            },
            {
                "seeAlso": "http://gnis-ld.org/lod/gnis/feature/722098"
            },
            {
                "evidence": {
                    "@id": "http://devstore.rerum.io/v1/id/5b76fc0de4b09992fca21e68",
                    "@type": "Document"
                }
            }
        ]
    }
    datar.annoD1 = {
        "@context": "",
        "@id": "http://devstore.rerum.io/v1/id/5b7705d0e4b09992fca21e9b",
        "@type": "Annotation",
        "motivation": "describing",
        "target": "http://devstore.rerum.io/v1/id/5b76fc0de4b09992fca21e68",
        "body": [{
                "label": "McElwee Cemetery Catalog"
            },
            {
                "describes": {
                    "@id": "l001",
                    "@type": "Location"
                }
            },
            {
                "evidence": "http://public.fotki.com/iowaz/pike-co-missouri/mcelwee-cem-pike-co/burials-mcelwee-cem/"
            },
            {
                "description": "Printed catalog of grave markers available at some date."
            }
        ]
    }

    for (e in datar) {
        if (!localStorage.getItem(datar[e]['@id']))
            localStorage.setItem(datar[e]["@id"], JSON.stringify(datar[e]))
    }
    if(!localStorage.getItem("CURRENT_LIST_ID"))localStorage.setItem("CURRENT_LIST_ID","http://devstore.rerum.io/v1/id/5b998c95e4b09992fca21fd0")

})()