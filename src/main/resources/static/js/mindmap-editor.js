const SVG_NS = "http://www.w3.org/2000/svg";
const NODE_WIDTH = 180;
const NODE_HEIGHT = 64;

const state = {
    map: structuredClone(initialMap),
    selectedNodeId: null,
    drag: null,
    autosaveTimer: null,
};

const svg = document.getElementById("mindmap-canvas");
const textInput = document.getElementById("node-text");
const colorInput = document.getElementById("node-color");
const fontSizeInput = document.getElementById("node-font-size");
const autosaveStatus = document.getElementById("autosave-status");

function getNodeById(id) {
    return state.map.nodes.find(n => n.id === id);
}

function render() {
    svg.innerHTML = "";

    for (const node of state.map.nodes) {
        if (node.parentId != null) {
            const parent = getNodeById(node.parentId);
            if (parent) {
                const line = document.createElementNS(SVG_NS, "line");
                line.setAttribute("class", "connector");
                line.setAttribute("x1", parent.x + NODE_WIDTH / 2);
                line.setAttribute("y1", parent.y + NODE_HEIGHT / 2);
                line.setAttribute("x2", node.x + NODE_WIDTH / 2);
                line.setAttribute("y2", node.y + NODE_HEIGHT / 2);
                svg.appendChild(line);
            }
        }
    }

    for (const node of state.map.nodes) {
        const group = document.createElementNS(SVG_NS, "g");
        group.setAttribute("class", `node-group${node.id === state.selectedNodeId ? " selected" : ""}`);
        group.dataset.id = node.id;

        const rect = document.createElementNS(SVG_NS, "rect");
        rect.setAttribute("x", node.x);
        rect.setAttribute("y", node.y);
        rect.setAttribute("rx", 18);
        rect.setAttribute("ry", 18);
        rect.setAttribute("width", NODE_WIDTH);
        rect.setAttribute("height", NODE_HEIGHT);
        rect.setAttribute("fill", node.color || "#FFD966");
        rect.setAttribute("stroke", "#546170");
        rect.setAttribute("stroke-width", "1.5");
        group.appendChild(rect);

        const text = document.createElementNS(SVG_NS, "text");
        text.setAttribute("class", "node-text");
        text.setAttribute("x", node.x + NODE_WIDTH / 2);
        text.setAttribute("y", node.y + NODE_HEIGHT / 2 + 2);
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("dominant-baseline", "middle");
        text.setAttribute("font-size", node.fontSize || 18);
        text.textContent = truncate(node.text || "Nodo", 20);
        group.appendChild(text);

        group.addEventListener("mousedown", startDrag);
        group.addEventListener("click", () => selectNode(node.id));
        group.addEventListener("dblclick", () => quickEdit(node.id));
        svg.appendChild(group);
    }
}

function truncate(text, max) {
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function selectNode(nodeId) {
    state.selectedNodeId = nodeId;
    const node = getNodeById(nodeId);
    if (!node) return;
    textInput.value = node.text || "";
    colorInput.value = node.color || "#FFD966";
    fontSizeInput.value = node.fontSize || 18;
    render();
}

function startDrag(event) {
    const nodeId = Number(event.currentTarget.dataset.id);
    selectNode(nodeId);
    const node = getNodeById(nodeId);
    if (!node) return;

    const point = toSvgPoint(event);
    state.drag = {
        nodeId,
        offsetX: point.x - node.x,
        offsetY: point.y - node.y,
    };
}

function toSvgPoint(event) {
    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
}

document.addEventListener("mousemove", event => {
    if (!state.drag) return;
    const node = getNodeById(state.drag.nodeId);
    if (!node) return;
    const point = toSvgPoint(event);
    node.x = Math.round(point.x - state.drag.offsetX);
    node.y = Math.round(point.y - state.drag.offsetY);
    render();
    scheduleAutosave(node);
});

document.addEventListener("mouseup", () => {
    state.drag = null;
});

document.getElementById("save-node-btn").addEventListener("click", async () => {
    const node = getNodeById(state.selectedNodeId);
    if (!node) return;
    node.text = textInput.value.trim() || "Nodo";
    node.color = colorInput.value;
    node.fontSize = Number(fontSizeInput.value);
    render();
    await saveNode(node);
});

document.getElementById("add-root-btn").addEventListener("click", async () => {
    const node = await createNode({
        parentId: null,
        text: "Nuovo nodo",
        x: 180 + Math.round(Math.random() * 700),
        y: 120 + Math.round(Math.random() * 500),
        color: "#D9D2E9",
        fontSize: 18,
        shape: "ROUNDED"
    });
    state.map.nodes.push(node);
    selectNode(node.id);
    render();
});

document.getElementById("add-child-btn").addEventListener("click", async () => {
    const parent = getNodeById(state.selectedNodeId);
    if (!parent) return alert("Seleziona prima un nodo.");
    const node = await createNode({
        parentId: parent.id,
        text: "Nuovo ramo",
        x: parent.x + 220,
        y: parent.y + 90,
        color: "#9FC5E8",
        fontSize: 18,
        shape: "ROUNDED"
    });
    state.map.nodes.push(node);
    selectNode(node.id);
    render();
});

document.getElementById("delete-node-btn").addEventListener("click", async () => {
    const node = getNodeById(state.selectedNodeId);
    if (!node) return;
    const rootCount = state.map.nodes.filter(n => n.parentId == null).length;
    if (node.parentId == null && rootCount === 1) {
        alert("La mappa deve avere almeno un nodo principale.");
        return;
    }
    if (!confirm("Eliminare questo nodo e i suoi rami?")) return;
    await fetch(`/api/nodes/${node.id}`, { method: "DELETE" });
    state.map = await fetchMap();
    state.selectedNodeId = state.map.nodes[0]?.id ?? null;
    if (state.selectedNodeId) selectNode(state.selectedNodeId);
    render();
});

document.getElementById("export-png-btn").addEventListener("click", () => exportPng());

async function createNode(payload) {
    const response = await fetch(`/api/maps/${state.map.id}/nodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    return response.json();
}

async function saveNode(node) {
    autosaveStatus.textContent = "Salvataggio in corso...";
    await fetch(`/api/nodes/${node.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(node)
    });
    autosaveStatus.textContent = "Modifiche salvate.";
}

function scheduleAutosave(node) {
    autosaveStatus.textContent = "Modifiche non ancora salvate...";
    clearTimeout(state.autosaveTimer);
    state.autosaveTimer = setTimeout(() => saveNode(node), 500);
}

async function fetchMap() {
    const response = await fetch(`/api/maps/${state.map.id}`);
    return response.json();
}

async function quickEdit(nodeId) {
    const node = getNodeById(nodeId);
    const value = prompt("Testo del nodo", node.text || "Nodo");
    if (value == null) return;
    node.text = value.trim() || "Nodo";
    render();
    await saveNode(node);
}

function exportPng() {
    const clone = svg.cloneNode(true);
    clone.setAttribute("xmlns", SVG_NS);
    const data = new XMLSerializer().serializeToString(clone);
    const svgBlob = new Blob([data], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 1400;
        canvas.height = 900;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        const link = document.createElement("a");
        link.download = `${slugify(state.map.title || "mappa")}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
    };
    img.src = url;
}

function slugify(value) {
    return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || "mappa";
}

selectNode(state.map.nodes[0]?.id ?? null);
render();
