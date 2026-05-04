# 🧠✨ Alice's Simple MindMap

Benvenuto in **Alice's Simple MindMap**, una web app leggera e immediata per creare mappe mentali in pochi click.
Pensata per essere intuitiva anche per chi non è tecnico ma costruita con uno stack solido e moderno.

---

## 🚀 Cos'è

Simple MindMap è un'applicazione Java/Spring Boot con interfaccia Thymeleaf che permette di:

- creare una nuova mappa,
- partire da un nodo centrale,
- aggiungere rami e sotto-rami,
- personalizzare testo e stile,
- esportare il risultato.

Obiettivo: **trasformare idee in una struttura visiva chiara**.

---

## 🌟 Caratteristiche principali

- ✅ Creazione mappa rapida
- ✅ Nodo principale automatico
- ✅ Template pronti (Italiano, Scienze, Storia, Geografia)
- ✅ Generazione mappe anche con AI
- ✅ Aggiunta nodi principali e nodi figli
- ✅ Drag & drop dei nodi
- ✅ Modifica testo, colore e dimensione font
- ✅ Doppio click per editing veloce
- ✅ Autosave dei nodi
- ✅ Export PNG direttamente dal browser
- ✅ Export HTML stampabile dal backend
- ✅ Eliminazione mappe e nodi

---

## 🧱 Stack tecnologico

### Backend
- **Java 21**
- **Spring Boot 3.3.1**
- **Spring Data JPA**
- **H2 Database** (persistito su file)

### Frontend
- **Thymeleaf**
- **JavaScript vanilla**
- **SVG** per rendering visuale della mappa

### Build & Tooling
- **Maven**

---

## 📋 Prerequisiti

Prima di avviare il progetto assicurati di avere:

- **JDK 21** installato
- **Maven 3.9+** disponibile da terminale
- Un browser moderno (Chrome, Edge, Firefox)

Verifica veloce:

```bash
java -version
mvn -version
```

---

## 🛠️ Avvio locale

1. Clona il repository
2. Avvia l'app:

```bash
mvn spring-boot:run
```

3. Apri nel browser:

```text
http://localhost:8080/maps
```

---

## 🔌 API / Endpoints principali

> Nota: l'app usa pagine server-side Thymeleaf + chiamate AJAX per i nodi.

### UI routes
- `GET /maps` → elenco mappe
- `GET /maps/{id}` → editor della mappa

### Operazioni mappe (backend)
- Creazione nuova mappa
- Eliminazione mappa
- Export HTML stampabile

### Operazioni nodi (backend/API interne)
- Creazione nodo (principale/figlio)
- Aggiornamento nodo (testo, colore, font, posizione)
- Eliminazione nodo
- Salvataggio automatico modifiche

---

## 💾 Persistenza dati

- Database locale H2 persistito su file in:
  - `./data/mindmapdb`
- Nessuna dipendenza da DB esterno per lo sviluppo iniziale.

---

## 📤 Export

- **PNG**: export client-side dal browser
- **HTML**: export server-side in formato semplice e stampabile

---

## 🧪 Idee per evoluzioni future

- Export PDF server-side
- Undo/Redo completo
- Multiutenza con login
- Libreria icone e sticker
- Condivisione mappe via link

---

## 🤝 Contributi

Hai idee per rendere l'app ancora più utile o divertente?
Apri una issue o proponi una PR: ogni contributo è il benvenuto. 🚀

