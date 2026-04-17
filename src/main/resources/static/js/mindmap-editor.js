const SVG_NS = "http://www.w3.org/2000/svg";
const BASE_NODE_WIDTH = 180;
const BASE_NODE_HEIGHT = 64;
const IMAGE_NODE_WIDTH = 220;
const IMAGE_NODE_HEIGHT = 100;
const DEFAULT_IMAGE_SIZE = 42;
const MIN_IMAGE_SIZE = 24;
const MAX_IMAGE_SIZE = 120;

const state = {
    map: structuredClone(initialMap),
    selectedNodeId: null,
    drag: null,
    resize: null,
    autosaveTimer: null,
};

const svg = document.getElementById("mindmap-canvas");
const textInput = document.getElementById("node-text");
const colorInput = document.getElementById("node-color");
const fontSizeInput = document.getElementById("node-font-size");
const imageUrlInput = document.getElementById("node-image-url");
const imageUploadInput = document.getElementById("node-image-upload");
const imagePreview = document.getElementById("node-image-preview");
const imageWidthInput = document.getElementById("node-image-width");
const imageHeightInput = document.getElementById("node-image-height");
const imageWidthValue = document.getElementById("node-image-width-value");
const imageHeightValue = document.getElementById("node-image-height-value");
const autosaveStatus = document.getElementById("autosave-status");

function getNodeById(id) {
    return state.map.nodes.find(n => n.id === id);
}

function hasNodeImage(node) {
    return !!(node.imageUri && node.imageUri.trim());
}

function getNodeSize(node) {
    const imageSize = getNodeImageSize(node);
    return hasNodeImage(node)
        ? {
            width: Math.max(IMAGE_NODE_WIDTH, imageSize.width + 60),
            height: Math.max(IMAGE_NODE_HEIGHT, imageSize.height + 52)
        }
        : { width: BASE_NODE_WIDTH, height: BASE_NODE_HEIGHT };
}

function getNodeImageSize(node) {
    return {
        width: clampImageSize(Number(node.imageWidth) || DEFAULT_IMAGE_SIZE),
        height: clampImageSize(Number(node.imageHeight) || DEFAULT_IMAGE_SIZE),
    };
}

function render() {
    svg.innerHTML = "";

    for (const node of state.map.nodes) {
        if (node.parentId != null) {
            const parent = getNodeById(node.parentId);
            if (parent) {
                const parentSize = getNodeSize(parent);
                const nodeSize = getNodeSize(node);
                const line = document.createElementNS(SVG_NS, "line");
                line.setAttribute("class", "connector");
                line.setAttribute("x1", parent.x + parentSize.width / 2);
                line.setAttribute("y1", parent.y + parentSize.height / 2);
                line.setAttribute("x2", node.x + nodeSize.width / 2);
                line.setAttribute("y2", node.y + nodeSize.height / 2);
                svg.appendChild(line);
            }
        }
    }

    for (const node of state.map.nodes) {
        const { width, height } = getNodeSize(node);
        const group = document.createElementNS(SVG_NS, "g");
        group.setAttribute("class", `node-group${node.id === state.selectedNodeId ? " selected" : ""}`);
        group.dataset.id = node.id;

        const rect = document.createElementNS(SVG_NS, "rect");
        rect.setAttribute("x", node.x);
        rect.setAttribute("y", node.y);
        rect.setAttribute("rx", 18);
        rect.setAttribute("ry", 18);
        rect.setAttribute("width", width);
        rect.setAttribute("height", height);
        rect.setAttribute("fill", node.color || "#FFD966");
        rect.setAttribute("stroke", "#546170");
        rect.setAttribute("stroke-width", "1.5");
        group.appendChild(rect);

        if (hasNodeImage(node)) {
            renderNodeImage(group, node, width);
            if (node.id === state.selectedNodeId) {
                renderImageResizeHandle(group, node, width);
            }
        }

        const text = document.createElementNS(SVG_NS, "text");
        text.setAttribute("class", "node-text");
        text.setAttribute("x", node.x + width / 2);
        text.setAttribute("y", hasNodeImage(node) ? node.y + height - 18 : node.y + height / 2 + 2);
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("dominant-baseline", "middle");
        text.setAttribute("font-size", node.fontSize || 18);
        text.textContent = truncate(node.text || "Nodo", hasNodeImage(node) ? 18 : 20);
        group.appendChild(text);

        group.addEventListener("mousedown", startDrag);
        group.addEventListener("click", () => selectNode(node.id));
        group.addEventListener("dblclick", () => quickEdit(node.id));
        svg.appendChild(group);
    }
}

function renderNodeImage(group, node, width) {
    const { x: imageX, y: imageY, width: imageWidth, height: imageHeight } = getNodeImageBounds(node, width);
    const clipId = `clip-node-${node.id}`;

    const defs = document.createElementNS(SVG_NS, "defs");
    const clipPath = document.createElementNS(SVG_NS, "clipPath");
    clipPath.setAttribute("id", clipId);
    const clipRect = document.createElementNS(SVG_NS, "rect");
    clipRect.setAttribute("x", imageX);
    clipRect.setAttribute("y", imageY);
    clipRect.setAttribute("width", imageWidth);
    clipRect.setAttribute("height", imageHeight);
    clipRect.setAttribute("rx", 8);
    clipRect.setAttribute("ry", 8);
    clipPath.appendChild(clipRect);
    defs.appendChild(clipPath);
    group.appendChild(defs);

    const image = document.createElementNS(SVG_NS, "image");
    image.setAttribute("x", imageX);
    image.setAttribute("y", imageY);
    image.setAttribute("width", imageWidth);
    image.setAttribute("height", imageHeight);
    image.setAttribute("href", node.imageUri);
    image.setAttribute("preserveAspectRatio", "xMidYMid slice");
    image.setAttribute("clip-path", `url(#${clipId})`);
    group.appendChild(image);
}

function renderImageResizeHandle(group, node, nodeWidth) {
    const bounds = getNodeImageBounds(node, nodeWidth);
    const handle = document.createElementNS(SVG_NS, "circle");
    handle.setAttribute("class", "image-resize-handle");
    handle.setAttribute("cx", bounds.x + bounds.width);
    handle.setAttribute("cy", bounds.y + bounds.height);
    handle.setAttribute("r", "7");
    handle.dataset.nodeId = node.id;
    handle.addEventListener("mousedown", startImageResize);
    group.appendChild(handle);
}

function getNodeImageBounds(node, nodeWidth) {
    const size = getNodeImageSize(node);
    return {
        x: node.x + (nodeWidth - size.width) / 2,
        y: node.y + 12,
        width: size.width,
        height: size.height
    };
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
    imageUrlInput.value = node.imageUri || "";
    const imageSize = getNodeImageSize(node);
    imageWidthInput.value = imageSize.width;
    imageHeightInput.value = imageSize.height;
    updateImageSizeLabels();
    updateImagePreview(node.imageUri || "");
    render();
}

function startDrag(event) {
    if (state.resize) return;
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

function startImageResize(event) {
    event.stopPropagation();
    event.preventDefault();
    const nodeId = Number(event.currentTarget.dataset.nodeId);
    const node = getNodeById(nodeId);
    if (!node) return;

    selectNode(nodeId);
    const nodeSize = getNodeSize(node);
    const bounds = getNodeImageBounds(node, nodeSize.width);
    const point = toSvgPoint(event);
    state.resize = {
        nodeId,
        anchorX: bounds.x,
        anchorY: bounds.y,
        pointerOffsetX: bounds.x + bounds.width - point.x,
        pointerOffsetY: bounds.y + bounds.height - point.y,
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

document.addEventListener("mousemove", event => {
    if (!state.resize) return;
    const node = getNodeById(state.resize.nodeId);
    if (!node) return;
    const point = toSvgPoint(event);
    node.imageWidth = clampImageSize(point.x - state.resize.anchorX + state.resize.pointerOffsetX);
    node.imageHeight = clampImageSize(point.y - state.resize.anchorY + state.resize.pointerOffsetY);
    imageWidthInput.value = node.imageWidth;
    imageHeightInput.value = node.imageHeight;
    updateImageSizeLabels();
    render();
    scheduleAutosave(node);
});

document.addEventListener("mouseup", () => {
    state.drag = null;
    state.resize = null;
});

document.getElementById("save-node-btn").addEventListener("click", async () => {
    const node = getNodeById(state.selectedNodeId);
    if (!node) return;
    applyFormToNode(node);
    render();
    await saveNode(node);
});

document.getElementById("apply-image-url-btn").addEventListener("click", () => {
    const node = getNodeById(state.selectedNodeId);
    if (!node) return;
    node.imageUri = normalizeImageUri(imageUrlInput.value);
    ensureNodeImageSize(node);
    imageUrlInput.value = node.imageUri || "";
    updateImagePreview(node.imageUri || "");
    render();
});

document.getElementById("clear-image-btn").addEventListener("click", () => {
    imageUrlInput.value = "";
    updateImagePreview("");
    const node = getNodeById(state.selectedNodeId);
    if (!node) return;
    node.imageUri = null;
    node.imageWidth = DEFAULT_IMAGE_SIZE;
    node.imageHeight = DEFAULT_IMAGE_SIZE;
    imageWidthInput.value = DEFAULT_IMAGE_SIZE;
    imageHeightInput.value = DEFAULT_IMAGE_SIZE;
    updateImageSizeLabels();
    render();
});

imageUploadInput.addEventListener("change", event => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        const dataUrl = typeof reader.result === "string" ? reader.result : "";
        imageUrlInput.value = dataUrl;
        updateImagePreview(dataUrl);
        const node = getNodeById(state.selectedNodeId);
        if (!node) return;
        node.imageUri = dataUrl;
        ensureNodeImageSize(node);
        imageWidthInput.value = node.imageWidth;
        imageHeightInput.value = node.imageHeight;
        updateImageSizeLabels();
        render();
    };
    reader.readAsDataURL(file);
});

imageWidthInput.addEventListener("input", () => {
    const node = getNodeById(state.selectedNodeId);
    if (!node) return;
    node.imageWidth = clampImageSize(Number(imageWidthInput.value));
    imageWidthInput.value = node.imageWidth;
    updateImageSizeLabels();
    render();
});

imageHeightInput.addEventListener("input", () => {
    const node = getNodeById(state.selectedNodeId);
    if (!node) return;
    node.imageHeight = clampImageSize(Number(imageHeightInput.value));
    imageHeightInput.value = node.imageHeight;
    updateImageSizeLabels();
    render();
});

function updateImagePreview(uri) {
    if (uri) {
        imagePreview.src = uri;
        imagePreview.style.display = "block";
    } else {
        imagePreview.removeAttribute("src");
        imagePreview.style.display = "none";
    }
}

function applyFormToNode(node) {
    node.text = textInput.value.trim() || "Nodo";
    node.color = colorInput.value;
    node.fontSize = Number(fontSizeInput.value);
    node.imageUri = normalizeImageUri(imageUrlInput.value);
    node.imageWidth = clampImageSize(Number(imageWidthInput.value));
    node.imageHeight = clampImageSize(Number(imageHeightInput.value));
}

function normalizeImageUri(value) {
    const trimmed = (value || "").trim();
    return trimmed.length ? trimmed : null;
}

function clampImageSize(value) {
    if (!Number.isFinite(value)) return DEFAULT_IMAGE_SIZE;
    return Math.min(MAX_IMAGE_SIZE, Math.max(MIN_IMAGE_SIZE, Math.round(value)));
}

function ensureNodeImageSize(node) {
    node.imageWidth = clampImageSize(Number(node.imageWidth));
    node.imageHeight = clampImageSize(Number(node.imageHeight));
}

function updateImageSizeLabels() {
    imageWidthValue.textContent = imageWidthInput.value;
    imageHeightValue.textContent = imageHeightInput.value;
}

document.getElementById("add-root-btn").addEventListener("click", async () => {
    const node = await createNode({
        parentId: null,
        text: "Nuovo nodo",
        x: 180 + Math.round(Math.random() * 700),
        y: 120 + Math.round(Math.random() * 500),
        color: "#D9D2E9",
        fontSize: 18,
        shape: "ROUNDED",
        imageUri: null,
        imageWidth: DEFAULT_IMAGE_SIZE,
        imageHeight: DEFAULT_IMAGE_SIZE
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
        shape: "ROUNDED",
        imageUri: null,
        imageWidth: DEFAULT_IMAGE_SIZE,
        imageHeight: DEFAULT_IMAGE_SIZE
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
