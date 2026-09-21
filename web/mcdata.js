(function() {
    // hand-done data for McElwee
    // foaf, cidoc, bio not really preferenced yet...

    // The Entities
    let datar = {}
    datar.personCB = {
        "@context": "",
        "@id": "p001",
        "@type": "Person",
        "name": "Claud H. Bland"
    }
    datar.personJHB = {
        "@context": "",
        "@id": "p002",
        "@type": "Person",
        "name": "JH Bland"
    }
    datar.personJJB = {
        "@context": "",
        "@id": "p003",
        "@type": "Person",
        "name": "JJ Bland"
    }
    datar.personMLB = {
        "@context": "",
        "@id": "p004",
        "@type": "Person",
        "name": "Minnie Lee Bland"
    }
    datar.personSIHB = {
        "@context": "",
        "@id": "p005",
        "@type": "Person",
        "name": "Sarah I. Howell Bevard"
    }
    datar.personWB = {
        "@context": "",
        "@id": "p006",
        "@type": "Person",
        "name": "W.Brunaugh"
    }
    datar.personECC = {
        "@context": "",
        "@id": "p007",
        "@type": "Person",
        "name": "Elizabeth C. Carr"
    }
    datar.eventCBb = {
        "@context": "",
        "@id": "e001",
        "@type": "Event",
        "name": "Birth of Claud Bland"
    }
    datar.eventCBd = {
        "@context": "",
        "@id": "e002",
        "@type": "Event",
        "name": "Death of Claud Bland"
    }
    datar.itemMarker = {
        "@context": "",
        "@id": "t001",
        "@type": "Thing",
        "name": "Grave marker for Bland, Claud H."
    }
    datar.locationCemetery = {
        "@context": "",
        "@id": "l001",
        "@type": "Location",
        "name": "McElwee Cemetery"
    }
    datar.documentCatalog = {
        "@context": "",
        "@id": "https://store.rerum.io/v1/id/6ab15d292655eb9310888cfd",
        "@type": "Document",
        "name": "McElwee Cemetery Catalog"
    }
    datar.annoE1 = {
        "@context": "",
        "@id": "anE1",
        "@type": "Annotation",
        "motivation": "describing",
        "target": "e001",
        "body": [{
                "name": "The birth of Claud H. Bland"
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
                "name": "The death of Claud H. Bland"
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
                "name": "McElwee Cemetery"
            },
            {
                "description": "A small rural cemetery in Pike County, Missouri, near the town of Louisiana, named for the McElwee family. The source of this exhibit is a hand-made catalog of the cemetery's markers, digitized page by page; the catalog's own origin is unrecorded. The plot and parcel outlines associated with the site were drawn from modern county assessor records, not from the catalog, and show present landholding rather than the position of any grave. Families connected to the ground by kinship and neighborhood include Bland, Givens, Houchins, Rowley, and Wilsnack."
            },
            {
                "seeAlso": "http://gnis-ld.org/lod/gnis/feature/722098"
            },
            {
                "evidence": {
                    "@id": "https://store.rerum.io/v1/id/6ab15d292655eb9310888cfd",
                    "@type": "Document"
                }
            }
        ]
    }
    datar.annoD1 = {
        "@context": "",
        "@id": "https://store.rerum.io/v1/id/6ab15d292655eb9310888cfd",
        "@type": "Annotation",
        "motivation": "describing",
        "target": "https://store.rerum.io/v1/id/6ab15d292655eb9310888cfd",
        "body": [{
                "name": "McElwee Cemetery Catalog"
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
    if (!localStorage.getItem("CURRENT_LIST_ID")) {
        localStorage.setItem("CURRENT_LIST_ID", "https://store.rerum.io/v1/id/6ab15ef62655eb9310888d22")
    }
})()