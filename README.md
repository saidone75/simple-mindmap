# Mindmap Thymeleaf App - versione 2

Applicazione Java Spring Boot con Thymeleaf per creare mappe mentali in modo semplice.
Pensata come base pratica per utenti non tecnici, inclusi insegnanti della scuola primaria.

## Stack

- Java 21
- Spring Boot 3.3.1
- Thymeleaf
- Spring Data JPA
- H2 file database
- JavaScript + SVG

## Funzioni incluse

- Creazione nuova mappa
- Nodo principale automatico
- Modelli pronti: Italiano, Scienze, Storia, Geografia
- Aggiunta nodi principali e rami figli
- Drag & drop dei nodi
- Modifica testo, colore, dimensione font
- Doppio clic per modifica rapida del testo
- Autosave dei nodi
- Export PNG dal browser
- Export HTML stampabile dal backend
- Eliminazione mappa e nodi

## Avvio

```bash
mvn spring-boot:run
```

Apri poi:

```text
http://localhost:8080/maps
```

## Note

- Il database H2 è persistito su file locale in `./data/mindmapdb`.
- L'export PNG usa il browser, quindi funziona direttamente dalla pagina editor.
- L'export HTML genera un file semplice e stampabile.

## Migliorie possibili

- Esportazione PDF server-side
- Undo/redo
- Allegare immagini ai nodi
- Login multiutente
- Libreria icone per bambini
