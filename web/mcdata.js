(function(){
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
        "@id": "d001",
        "@type": "Document",
        "label": "McElwee Cemetery Catalog"
    }

    // The Annotations
    datar.annoP1 = {
        "@context": "",
        "@id": "anP1",
        "@type": "Annotation",
        "motivation": "describing",
        "target": "p001",
        "body": [
            { "givenName": "Claud" },
            { "familyName": "Bland" },
            { "gender": "male" },
            { "label": "Claud H. Bland" },
            { "name": "Claud H. Bland" },
            { "birthDate": "1882-03-25" },
            { "deathDate": "1883-12-12" },
            { "Birth": "e001" },
            { "Death": "e002" },
            { "evidence": "d001" }
        ]
    }
    datar.annoP2 = {
        "@context": "",
        "@id": "anP2",
        "@type": "Annotation",
        "motivation": "describing",
        "target": "p002",
        "body": [
            { "label": "J. H. Bland" },
            { "givenName": "J." },
            { "familyName": "Bland" },
            { "name": "J. H. Bland" },
            { "evidence": "d001" }
        ]
    }
    datar.annoP3 = {
        "@context": "",
        "@id": "anP3",
        "@type": "Annotation",
        "motivation": "describing",
        "target": "p003",
        "body": [
            { "label": "J. J. Bland" },
            { "givenName": "J." },
            { "familyName": "Bland" },
            { "name": "J. J. Bland" },
            { "evidence": "d001" }
        ]
    }
    datar.annoE1 = {
        "@context": "",
        "@id": "anE1",
        "@type": "Annotation",
        "motivation": "describing",
        "target": "e001",
        "body": [
            { "label": "The birth of Claud H. Bland" },
            { "principal": "p001" },
            { "parent": "p002" },
            { "parent": "p003" },
            { "date": "1882-03-25" }
        ]
    }
    datar.annoE2 = {
        "@context": "",
        "@id": "anE2",
        "@type": "Annotation",
        "motivation": "describing",
        "target": "e002",
        "body": [
            { "label": "The death of Claud H. Bland" },
            { "principal": "p001" },
            { "date": "1883-12-12" }
        ]
    }
    datar.annoT1 = {
        "@context": "",
        "@id": "anT1",
        "@type": "Annotation",
        "motivation": "describing",
        "target": "t001",
        "body": [
            { "seeAlso": "https://www.findagrave.com/memorial/5440149/claud-bland" },
            { "evidence": ["t001", "https://images.findagrave.com/photos/2013/93/5440149_136510870831.jpg"] }
        ]
    }
    datar.annoL1 = {
        "@context": "",
        "@id": "anL1",
        "@type": "Annotation",
        "motivation": "describing",
        "target": "l001",
        "body": [
            { "label": "McElwee Cemetery" },
            { "evidence": "d001" }
        ]
    }
    datar.annoD1 = {
        "@context": "",
        "@id": "anD1",
        "@type": "Annotation",
        "motivation": "describing",
        "target": "d001",
        "body": [
            { "label": "McElwee Cemetery Catalog" },
            { "evidence": "http://public.fotki.com/iowaz/pike-co-missouri/mcelwee-cem-pike-co/burials-mcelwee-cem/" },
            { "description": "Printed catalog of grave markers available at some date." }
        ]
    }

    for(e in datar) {
        localStorage.setItem(datar[e]["@id"],JSON.stringify(datar[e]))
    }
})()