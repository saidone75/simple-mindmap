const SVG_NS = "http://www.w3.org/2000/svg";
const BASE_NODE_WIDTH = 220;
const BASE_NODE_HEIGHT = 78;
const IMAGE_NODE_WIDTH = 260;
const IMAGE_NODE_HEIGHT = 130;
const DEFAULT_IMAGE_SIZE = 42;
const MIN_IMAGE_SIZE = 24;
const MAX_IMAGE_SIZE = 240;
const DEFAULT_MAP_STYLE = "CLASSIC";

const THEME_PRESETS = {
    CLASSIC: {
        pageClass: "theme-classic",
        canvasBackground: "linear-gradient(#fff, #fbfdff)",
        nodePalette: ["#FFD966", "#9FC5E8", "#B6D7A8", "#F4CCCC", "#F9CB9C", "#D9D2E9"],
        connectorPalette: ["#7c8a9a"]
    },
    PLAYFUL: {
        pageClass: "theme-playful",
        canvasBackground: "linear-gradient(180deg, #fff7ea 0%, #edf8ff 100%)",
        nodePalette: ["#FFD966", "#FFB5E8", "#A0E7E5", "#B4F8C8", "#FFC09F", "#C7CEEA"],
        connectorPalette: ["#ff7aa2", "#6bcb77", "#4d96ff", "#ffb347", "#9d6bff"]
    },
    OCEAN: {
        pageClass: "theme-ocean",
        canvasBackground: "linear-gradient(180deg, #e0f2fe 0%, #ecfeff 100%)",
        nodePalette: ["#8ecae6", "#219ebc", "#90e0ef", "#ade8f4", "#caf0f8", "#7bdff2"],
        connectorPalette: ["#0f4c81", "#0077b6", "#0096c7", "#00b4d8"]
    },
    CANDY: {
        pageClass: "theme-candy",
        canvasBackground: "linear-gradient(180deg, #fff0f6 0%, #f5f3ff 100%)",
        nodePalette: ["#ff8fab", "#ffc6ff", "#bde0fe", "#caffbf", "#ffd6a5", "#f1c0e8"],
        connectorPalette: ["#ff5d8f", "#7b2cbf", "#3a86ff", "#ff9f1c", "#2ec4b6"]
    }
};
const HAND_DRAWN_BRANCH_COLORS = ["#ef476f", "#118ab2", "#06d6a0", "#f78c27", "#9b5de5", "#ff006e"];
const HAND_DRAWN_NODE_COLORS_BY_DEPTH = {
    0: "#fff176",
    1: "#ffeaa7",
    2: "#d4f1f4",
    3: "#f7d6e0",
    4: "#d8f3dc"
};

const state = {
    map: structuredClone(initialMap),
    selectedNodeId: null,
    drag: null,
    resize: null,
    pendingImageNodeId: null,
    autosaveTimer: null,
    mapStyleTimer: null,
};

const svg = document.getElementById("mindmap-canvas");
const textInput = document.getElementById("node-text");
const colorInput = document.getElementById("node-color");
const branchColorInput = document.getElementById("branch-color");
const branchStyleInput = document.getElementById("branch-style");
const fontSizeInput = document.getElementById("node-font-size");
const imageUrlInput = document.getElementById("node-image-url");
const imageUploadInput = document.getElementById("node-image-upload");
const imagePreview = document.getElementById("node-image-preview");
const imageWidthInput = document.getElementById("node-image-width");
const imageHeightInput = document.getElementById("node-image-height");
const imageWidthValue = document.getElementById("node-image-width-value");
const imageHeightValue = document.getElementById("node-image-height-value");
const autosaveStatus = document.getElementById("autosave-status");
const mapThemeInput = document.getElementById("map-theme");
const editorPage = document.querySelector(".editor-page");

function getNodeById(id) {
    return state.map.nodes.find(n => n.id === id);
}

function hasNodeImage(node) {
    return !!(node.imageUri && node.imageUri.trim());
}

function getNodeSize(node) {
    const imageSize = getNodeImageSize(node);
    const fontSize = Number(node.fontSize) || 18;
    const lineHeight = Math.max(16, Math.round(fontSize * 1.2));
    const lineCount = getNodeDisplayLines(node, hasNodeImage(node) ? 18 : 20).length;
    const textBlockHeight = lineCount * lineHeight;
    return hasNodeImage(node)
        ? {
            width: Math.max(IMAGE_NODE_WIDTH, imageSize.width + 60),
            height: Math.max(IMAGE_NODE_HEIGHT, imageSize.height + textBlockHeight + 44)
        }
        : { width: BASE_NODE_WIDTH, height: Math.max(BASE_NODE_HEIGHT, textBlockHeight + 34) };
}

function getNodeImageSize(node) {
    return {
        width: clampImageSize(Number(node.imageWidth) || DEFAULT_IMAGE_SIZE),
        height: clampImageSize(Number(node.imageHeight) || DEFAULT_IMAGE_SIZE),
    };
}

function getActiveTheme() {
    return THEME_PRESETS[state.map.stylePreset] || THEME_PRESETS[DEFAULT_MAP_STYLE];
}

function buildDepthMap(nodes) {
    const byId = new Map(nodes.map(node => [node.id, node]));
    const depthMap = new Map();
    const visiting = new Set();

    function resolveDepth(node) {
        if (depthMap.has(node.id)) return depthMap.get(node.id);
        if (node.parentId == null || !byId.has(node.parentId)) {
            depthMap.set(node.id, 0);
            return 0;
        }
        if (visiting.has(node.id)) {
            depthMap.set(node.id, 0);
            return 0;
        }
        visiting.add(node.id);
        const depth = resolveDepth(byId.get(node.parentId)) + 1;
        visiting.delete(node.id);
        depthMap.set(node.id, depth);
        return depth;
    }

    for (const node of nodes) {
        resolveDepth(node);
    }
    return depthMap;
}

function getBranchRootId(node, byId) {
    let current = node;
    while (current?.parentId != null && byId.has(current.parentId)) {
        const parent = byId.get(current.parentId);
        if (parent.parentId == null) return current.id;
        current = parent;
    }
    return node.id;
}

function colorForDepth(depth) {
    return HAND_DRAWN_NODE_COLORS_BY_DEPTH[Math.min(depth, 4)] || HAND_DRAWN_NODE_COLORS_BY_DEPTH[4];
}

function applyMapThemeVisuals() {
    const theme = getActiveTheme();
    editorPage.classList.remove("theme-classic", "theme-playful", "theme-ocean", "theme-candy");
    editorPage.classList.add(theme.pageClass);
    svg.style.background = theme.canvasBackground;
}

function renderConnectorDefs() {
    const defs = document.createElementNS(SVG_NS, "defs");

    const arrow = document.createElementNS(SVG_NS, "marker");
    arrow.setAttribute("id", "arrow-head");
    arrow.setAttribute("viewBox", "0 0 10 10");
    arrow.setAttribute("refX", "10");
    arrow.setAttribute("refY", "5");
    arrow.setAttribute("markerWidth", "6");
    arrow.setAttribute("markerHeight", "6");
    arrow.setAttribute("orient", "auto-start-reverse");
    const arrowPath = document.createElementNS(SVG_NS, "path");
    arrowPath.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
    arrowPath.setAttribute("fill", "#4b5563");
    arrow.appendChild(arrowPath);
    defs.appendChild(arrow);

    const arrowBold = document.createElementNS(SVG_NS, "marker");
    arrowBold.setAttribute("id", "arrow-head-bold");
    arrowBold.setAttribute("viewBox", "0 0 14 14");
    arrowBold.setAttribute("refX", "14");
    arrowBold.setAttribute("refY", "7");
    arrowBold.setAttribute("markerWidth", "8");
    arrowBold.setAttribute("markerHeight", "8");
    arrowBold.setAttribute("orient", "auto-start-reverse");
    const arrowBoldPath = document.createElementNS(SVG_NS, "path");
    arrowBoldPath.setAttribute("d", "M 0 0 L 14 7 L 0 14 z");
    arrowBoldPath.setAttribute("fill", "#374151");
    arrowBold.appendChild(arrowBoldPath);
    defs.appendChild(arrowBold);

    svg.appendChild(defs);
}

function applyBranchStyle(path, node, connectorIndex, depth = 1) {
    const theme = getActiveTheme();
    const style = (node.branchStyle || "SOLID").toUpperCase();
    const fallbackColor = theme.connectorPalette[connectorIndex % theme.connectorPalette.length];
    const strokeColor = node.branchColor || fallbackColor || "#7c8a9a";

    path.setAttribute("stroke", strokeColor);
    const baseWidth = Math.max(2, 6 - Math.min(depth, 4));
    path.setAttribute("stroke-width", String(baseWidth));
    path.removeAttribute("stroke-dasharray");
    path.removeAttribute("marker-end");
    path.setAttribute("stroke-linecap", "round");

    switch (style) {
        case "DASHED":
            path.setAttribute("stroke-dasharray", "10 7");
            break;
        case "DOTTED":
            path.setAttribute("stroke-dasharray", "2 8");
            path.setAttribute("stroke-linecap", "round");
            break;
        case "BOLD":
            path.setAttribute("stroke-width", String(baseWidth + 2));
            break;
        case "DOUBLE":
            path.setAttribute("stroke-width", String(baseWidth + 2));
            path.setAttribute("stroke-dasharray", "1 2");
            break;
        case "ZIGZAG":
            path.setAttribute("stroke-dasharray", "14 5 3 5");
            break;
        case "ARROW":
            path.setAttribute("marker-end", "url(#arrow-head)");
            break;
        case "BOLD_ARROW":
            path.setAttribute("stroke-width", String(baseWidth + 2));
            path.setAttribute("marker-end", "url(#arrow-head-bold)");
            break;
        default:
            break;
    }
}

function render() {
    svg.innerHTML = "";
    renderConnectorDefs();
    applyMapThemeVisuals();
    const depthMap = buildDepthMap(state.map.nodes);

    let connectorIndex = 0;
    for (const node of state.map.nodes) {
        if (node.parentId != null) {
            const parent = getNodeById(node.parentId);
            if (parent) {
                const parentSize = getNodeSize(parent);
                const nodeSize = getNodeSize(node);
                const path = document.createElementNS(SVG_NS, "path");
                const x1 = parent.x + parentSize.width / 2;
                const y1 = parent.y + parentSize.height / 2;
                const x2 = node.x + nodeSize.width / 2;
                const y2 = node.y + nodeSize.height / 2;
                const cx = (x1 + x2) / 2;
                const depth = depthMap.get(node.id) || 1;
                const bend = Math.max(22, 44 - depth * 4);
                const direction = x2 >= x1 ? -1 : 1;
                const cy = (y1 + y2) / 2 + (direction * bend);

                path.setAttribute("class", "connector");
                path.setAttribute("d", `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`);
                applyBranchStyle(path, node, connectorIndex++, depth);
                svg.appendChild(path);
            }
        }
    }

    for (const node of state.map.nodes) {
        const depth = depthMap.get(node.id) || 0;
        const { width, height } = getNodeSize(node);
        const group = document.createElementNS(SVG_NS, "g");
        group.setAttribute("class", `node-group${node.id === state.selectedNodeId ? " selected" : ""}`);
        group.dataset.id = node.id;

        const rect = document.createElementNS(SVG_NS, "rect");
        rect.setAttribute("x", node.x);
        rect.setAttribute("y", node.y);
        rect.setAttribute("rx", depth === 0 ? 10 : 20);
        rect.setAttribute("ry", depth === 0 ? 10 : 20);
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

        renderNodeActionButtons(group, node, width);

        const text = document.createElementNS(SVG_NS, "text");
        const lines = getNodeDisplayLines(node, hasNodeImage(node) ? 18 : 20);
        const fontSize = Number(node.fontSize) || 18;
        const lineHeight = Math.max(16, Math.round(fontSize * 1.2));
        const firstLineY = hasNodeImage(node)
            ? node.y + height - 16 - ((lines.length - 1) * lineHeight)
            : node.y + ((height - ((lines.length - 1) * lineHeight)) / 2);
        text.setAttribute("class", "node-text");
        text.setAttribute("x", node.x + width / 2);
        text.setAttribute("y", firstLineY);
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("dominant-baseline", "middle");
        text.setAttribute("font-size", fontSize);
        lines.forEach((line, index) => {
            const tspan = document.createElementNS(SVG_NS, "tspan");
            tspan.setAttribute("x", node.x + width / 2);
            tspan.setAttribute("dy", index === 0 ? "0" : String(lineHeight));
            tspan.textContent = line || " ";
            text.appendChild(tspan);
        });
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

function renderNodeActionButtons(group, node, nodeWidth) {
    const actions = [
        {
            key: "delete-node",
            label: "🗑",
            title: "Elimina nodo",
            onClick: () => deleteNodeWithChecks(node.id),
            x: node.x + nodeWidth - 72
        },
        {
            key: "add-image",
            label: "🖼",
            title: "Aggiungi immagine",
            onClick: () => startImageUploadForNode(node.id),
            x: node.x + nodeWidth - 48
        },
        {
            key: "add-child",
            label: "+",
            title: "Aggiungi nodo figlio",
            onClick: () => addChildNode(node.id),
            x: node.x + nodeWidth - 24
        }
    ];

    for (const action of actions) {
        const button = document.createElementNS(SVG_NS, "g");
        button.setAttribute("class", "node-action-button");
        button.dataset.nodeId = node.id;
        button.dataset.action = action.key;
        button.setAttribute("transform", `translate(${action.x}, ${node.y + 16})`);
        button.addEventListener("mousedown", event => {
            event.stopPropagation();
            event.preventDefault();
        });
        button.addEventListener("click", async event => {
            event.stopPropagation();
            event.preventDefault();
            selectNode(node.id);
            await action.onClick();
        });

        const circle = document.createElementNS(SVG_NS, "circle");
        circle.setAttribute("r", "10");
        circle.setAttribute("cx", "0");
        circle.setAttribute("cy", "0");
        button.appendChild(circle);

        const icon = document.createElementNS(SVG_NS, "text");
        icon.setAttribute("x", "0");
        icon.setAttribute("y", "1");
        icon.setAttribute("text-anchor", "middle");
        icon.setAttribute("dominant-baseline", "middle");
        icon.setAttribute("class", "node-action-icon");
        icon.textContent = action.label;
        button.appendChild(icon);

        const tooltip = document.createElementNS(SVG_NS, "title");
        tooltip.textContent = action.title;
        button.appendChild(tooltip);

        group.appendChild(button);
    }
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

function normalizeNodeText(value) {
    const normalized = (value || "")
        .replace(/\r\n/g, "\n")
        .replace(/\u00a0/g, " ")
        .trim();
    return normalized.length ? normalized : "Nodo";
}

function getNodeDisplayLines(node, maxLineLength) {
    return normalizeNodeText(node.text || "Nodo")
        .split("\n")
        .map(line => truncate(line, maxLineLength));
}

function selectNode(nodeId) {
    state.selectedNodeId = nodeId;
    const node = getNodeById(nodeId);
    if (!node) return;
    textInput.value = node.text || "";
    colorInput.value = node.color || "#FFD966";
    branchColorInput.value = node.branchColor || "#7c8a9a";
    branchStyleInput.value = node.branchStyle || "SOLID";
    fontSizeInput.value = node.fontSize || 18;
    imageUrlInput.value = node.imageUri || "";
    const imageSize = getNodeImageSize(node);
    imageWidthInput.value = imageSize.width;
    imageHeightInput.value = imageSize.height;
    updateImageSizeLabels();
    updateImagePreview(node.imageUri || "");
    mapThemeInput.value = state.map.stylePreset || DEFAULT_MAP_STYLE;
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

document.getElementById("apply-theme-btn").addEventListener("click", async () => {
    await saveMapStyle(mapThemeInput.value);
});

document.getElementById("apply-branch-style-all-btn").addEventListener("click", async () => {
    const selected = getNodeById(state.selectedNodeId);
    if (!selected) return;
    applyFormToNode(selected);
    const updates = state.map.nodes
        .filter(node => node.parentId != null)
        .map(node => {
            node.branchStyle = selected.branchStyle;
            node.branchColor = selected.branchColor;
            return saveNode(node);
        });
    render();
    await Promise.all(updates);
    autosaveStatus.textContent = "Stile rami applicato a tutta la mappa.";
});

document.getElementById("render-sketch-btn").addEventListener("click", async () => {
    await applyHandDrawnRenderPass();
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
        const targetNodeId = state.pendingImageNodeId ?? state.selectedNodeId;
        const node = getNodeById(targetNodeId);
        state.pendingImageNodeId = null;
        event.target.value = "";
        if (!node) return;
        imageUrlInput.value = dataUrl;
        updateImagePreview(dataUrl);
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

const autosubmitFields = [textInput, colorInput, branchColorInput, branchStyleInput, fontSizeInput, imageUrlInput];
for (const field of autosubmitFields) {
    const eventName = field === textInput || field === imageUrlInput ? "input" : "change";
    field.addEventListener(eventName, () => queueAutoSubmitSelectedNode());
}
imageWidthInput.addEventListener("change", () => queueAutoSubmitSelectedNode());
imageHeightInput.addEventListener("change", () => queueAutoSubmitSelectedNode());
mapThemeInput.addEventListener("change", () => {
    state.map.stylePreset = mapThemeInput.value;
    render();
    scheduleMapStyleAutosave();
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
    node.text = normalizeNodeText(textInput.value);
    node.color = colorInput.value;
    node.branchColor = branchColorInput.value;
    node.branchStyle = branchStyleInput.value;
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
        branchColor: "#7c8a9a",
        branchStyle: "SOLID",
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
    await addChildNode(parent.id);
});

document.getElementById("delete-node-btn").addEventListener("click", async () => {
    if (state.selectedNodeId == null) return;
    await deleteNodeWithChecks(state.selectedNodeId);
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

function queueAutoSubmitSelectedNode() {
    const node = getNodeById(state.selectedNodeId);
    if (!node) return;
    applyFormToNode(node);
    render();
    scheduleAutosave(node);
}

function scheduleAutosave(node) {
    autosaveStatus.textContent = "Modifiche non ancora salvate...";
    clearTimeout(state.autosaveTimer);
    state.autosaveTimer = setTimeout(() => saveNode(node), 500);
}

function scheduleMapStyleAutosave() {
    autosaveStatus.textContent = "Stile mappa in salvataggio automatico...";
    clearTimeout(state.mapStyleTimer);
    state.mapStyleTimer = setTimeout(() => saveMapStyle(state.map.stylePreset), 400);
}

async function saveMapStyle(stylePreset) {
    const normalized = stylePreset || DEFAULT_MAP_STYLE;
    state.map.stylePreset = normalized;
    mapThemeInput.value = normalized;
    applyMapThemeVisuals();
    autosaveStatus.textContent = "Salvataggio stile mappa...";
    const response = await fetch(`/api/maps/${state.map.id}/style`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stylePreset: normalized })
    });
    if (response.ok) {
        const updatedMap = await response.json();
        state.map.stylePreset = updatedMap.stylePreset || normalized;
    }
    autosaveStatus.textContent = "Stile mappa salvato.";
    render();
}

async function applyHandDrawnRenderPass() {
    if (!state.map.nodes.length) return;
    autosaveStatus.textContent = "Render finale in corso...";
    await saveMapStyle("PLAYFUL");

    const byId = new Map(state.map.nodes.map(node => [node.id, node]));
    const depthMap = buildDepthMap(state.map.nodes);
    const branchColorByTopLevel = new Map();
    let paletteIndex = 0;

    for (const node of state.map.nodes) {
        const depth = depthMap.get(node.id) || 0;
        if (depth === 0) {
            node.color = "#fff176";
            node.fontSize = 30;
            node.branchStyle = "BOLD";
            node.branchColor = HAND_DRAWN_BRANCH_COLORS[paletteIndex % HAND_DRAWN_BRANCH_COLORS.length];
            paletteIndex += 1;
            continue;
        }

        const topLevelBranchNodeId = getBranchRootId(node, byId);
        if (!branchColorByTopLevel.has(topLevelBranchNodeId)) {
            branchColorByTopLevel.set(
                topLevelBranchNodeId,
                HAND_DRAWN_BRANCH_COLORS[branchColorByTopLevel.size % HAND_DRAWN_BRANCH_COLORS.length]
            );
        }
        node.branchColor = branchColorByTopLevel.get(topLevelBranchNodeId);
        node.color = colorForDepth(depth);
        node.fontSize = Math.max(16, 26 - depth * 2);
        node.branchStyle = depth <= 1 ? "BOLD" : depth <= 2 ? "SOLID" : "DASHED";
    }

    render();
    await Promise.all(state.map.nodes.map(node => saveNode(node)));
    autosaveStatus.textContent = "Render finale applicato: stile hand-drawn pronto.";
}

async function fetchMap() {
    const response = await fetch(`/api/maps/${state.map.id}`);
    return response.json();
}

function startImageUploadForNode(nodeId) {
    state.pendingImageNodeId = nodeId;
    imageUploadInput.click();
}

async function addChildNode(parentId) {
    const parent = getNodeById(parentId);
    if (!parent) return;
    const node = await createNode({
        parentId: parent.id,
        text: "Nuovo ramo",
        x: parent.x + 220,
        y: parent.y + 90,
        color: "#9FC5E8",
        fontSize: 18,
        shape: "ROUNDED",
        branchColor: "#7c8a9a",
        branchStyle: "SOLID",
        imageUri: null,
        imageWidth: DEFAULT_IMAGE_SIZE,
        imageHeight: DEFAULT_IMAGE_SIZE
    });
    state.map.nodes.push(node);
    selectNode(node.id);
    render();
}

async function deleteNodeWithChecks(nodeId) {
    const node = getNodeById(nodeId);
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
}

async function quickEdit(nodeId) {
    selectNode(nodeId);
    textInput.focus();
    textInput.setSelectionRange(0, textInput.value.length);
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

state.map.stylePreset = state.map.stylePreset || DEFAULT_MAP_STYLE;
mapThemeInput.value = state.map.stylePreset;
selectNode(state.map.nodes[0]?.id ?? null);
render();
