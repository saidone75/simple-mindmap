const SVG_NS = "http://www.w3.org/2000/svg";
const BASE_NODE_WIDTH = 220;
const BASE_NODE_HEIGHT = 78;
const IMAGE_NODE_WIDTH = 260;
const IMAGE_NODE_HEIGHT = 130;
const DEFAULT_IMAGE_SIZE = 42;
const MIN_IMAGE_SIZE = 24;
const MAX_IMAGE_SIZE = 240;
const MAP_CENTER_X = 700;
const MAP_CENTER_Y = 450;

const state = {
    map: structuredClone(initialMap),
    selectedNodeId: null,
    drag: null,
    resize: null,
    pendingImageNodeId: null,
    autosaveTimer: null,
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
const nodeEmojiInput = document.getElementById("node-emoji");
const branchTextInput = document.getElementById("branch-text");
const mapStyleInput = document.getElementById("map-style");
const autoLayoutBtn = document.getElementById("auto-layout-btn");

function getNodeById(id) {
    return state.map.nodes.find(n => n.id === id);
}

function hasNodeImage(node) {
    return !!(node.imageUri && node.imageUri.trim());
}

function hasNodeEmoji(node) {
    return !!normalizeNodeEmoji(node.emoji);
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

function isSketchPreset() {
    return (state.map.stylePreset || "CLASSIC").toUpperCase() === "PLAYFUL";
}

function getSketchNodeSize(node) {
    const lines = getNodeDisplayLines(node, 24);
    const longest = lines.reduce((max, line) => Math.max(max, line.length), 0);
    const fontSize = Number(node.fontSize) || 18;
    const width = Math.max(120, (longest * (fontSize * 0.65)) + 36);
    const height = Math.max(56, (lines.length * (fontSize * 1.2)) + 28);
    return { width, height };
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

function applyBranchStyle(path, node, depth = 1) {
    const style = (node.branchStyle || "SOLID").toUpperCase();
    const strokeColor = node.branchColor || "#7c8a9a";

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
    const depthMap = buildDepthMap(state.map.nodes);
    const sketchPreset = isSketchPreset();

    for (const node of state.map.nodes) {
        if (node.parentId != null) {
            const parent = getNodeById(node.parentId);
            if (parent) {
                const parentSize = sketchPreset ? getSketchNodeSize(parent) : getNodeSize(parent);
                const nodeSize = sketchPreset ? getSketchNodeSize(node) : getNodeSize(node);
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
                applyBranchStyle(path, node, depth);
                if (sketchPreset) {
                    path.classList.add("connector-sketch");
                    path.removeAttribute("marker-end");
                    path.setAttribute("stroke-width", String(Math.max(2.5, 5.5 - Math.min(depth, 3))));
                }
                svg.appendChild(path);
                renderBranchLabel(node, cx, cy, x1, y1, x2, y2);
            }
        }
    }

    for (const node of state.map.nodes) {
        const depth = depthMap.get(node.id) || 0;
        const { width, height } = sketchPreset ? getSketchNodeSize(node) : getNodeSize(node);
        const group = document.createElementNS(SVG_NS, "g");
        const selectedClass = node.id === state.selectedNodeId ? " selected" : "";
        group.setAttribute("class", `node-group${selectedClass}${sketchPreset ? " sketch-node" : ""}`);
        group.dataset.id = node.id;

        const rect = document.createElementNS(SVG_NS, "rect");
        rect.setAttribute("x", node.x);
        rect.setAttribute("y", node.y);
        rect.setAttribute("rx", sketchPreset ? 16 : depth === 0 ? 10 : 20);
        rect.setAttribute("ry", sketchPreset ? 16 : depth === 0 ? 10 : 20);
        rect.setAttribute("width", width);
        rect.setAttribute("height", height);
        rect.setAttribute("fill", sketchPreset ? "rgba(255,255,255,0.001)" : (node.color || "#FFD966"));
        rect.setAttribute("stroke", sketchPreset ? "transparent" : "#546170");
        rect.setAttribute("stroke-width", sketchPreset ? "0" : "1.5");
        group.appendChild(rect);

        if (hasNodeImage(node) && !sketchPreset) {
            renderNodeImage(group, node, width);
            if (node.id === state.selectedNodeId) {
                renderImageResizeHandle(group, node, width);
            }
        }

        if (!sketchPreset) {
            renderNodeActionButtons(group, node, width);
        }

        const emojiValue = hasNodeImage(node) ? "" : normalizeNodeEmoji(node.emoji);
        if (emojiValue && !sketchPreset) {
            const emoji = document.createElementNS(SVG_NS, "text");
            emoji.setAttribute("class", "node-emoji");
            emoji.setAttribute("x", node.x + width / 2);
            emoji.setAttribute("y", node.y + 28);
            emoji.setAttribute("text-anchor", "middle");
            emoji.setAttribute("dominant-baseline", "middle");
            emoji.textContent = emojiValue;
            emoji.addEventListener("mousedown", event => event.stopPropagation());
            emoji.addEventListener("click", async event => {
                event.stopPropagation();
                await quickEdit(node.id);
            });
            group.appendChild(emoji);
        }

        const text = document.createElementNS(SVG_NS, "text");
        const lines = getNodeDisplayLines(node, sketchPreset ? 24 : (hasNodeImage(node) ? 18 : 20));
        const fontSize = Number(node.fontSize) || 18;
        const lineHeight = Math.max(16, Math.round(fontSize * 1.2));
        const firstLineY = hasNodeImage(node) && !sketchPreset
            ? node.y + height - 16 - ((lines.length - 1) * lineHeight)
            : emojiValue && !sketchPreset
                ? node.y + ((height - ((lines.length - 1) * lineHeight)) / 2) + 14
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
        text.addEventListener("mousedown", event => event.stopPropagation());
        text.addEventListener("click", async event => {
            event.stopPropagation();
            await quickEdit(node.id);
        });
        group.appendChild(text);

        if (sketchPreset) {
            const underline = document.createElementNS(SVG_NS, "path");
            const underlineY = node.y + height - 10;
            const left = node.x + 10;
            const right = node.x + width - 10;
            const mid = (left + right) / 2;
            underline.setAttribute("d", `M ${left} ${underlineY} Q ${mid} ${underlineY + 8} ${right} ${underlineY}`);
            underline.setAttribute("stroke", node.branchColor || "#2f855a");
            underline.setAttribute("stroke-width", depth === 0 ? "3.8" : "2.6");
            underline.setAttribute("fill", "none");
            underline.setAttribute("stroke-linecap", "round");
            group.appendChild(underline);
        }

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
            key: "add-child",
            label: "➕",
            title: "Aggiungi nodo figlio",
            onClick: () => addChildNode(node.id)
        },
        {
            key: "add-image",
            label: "🖼️",
            title: "Aggiungi immagine",
            onClick: () => startImageUploadForNode(node.id)
        },
        {
            key: "edit-emoji",
            label: "😀",
            title: "Emoji nodo",
            onClick: () => quickEditEmoji(node.id)
        },
        {
            key: "edit-branch-text",
            label: "🌿",
            title: "Testo ramo",
            onClick: () => quickEditBranchText(node.id)
        },
        {
            key: "delete-node",
            label: "🗑️",
            title: "Elimina nodo",
            onClick: () => deleteNodeWithChecks(node.id)
        }
    ];

    const spacing = 34;
    const startX = node.x + (nodeWidth / 2) - ((actions.length - 1) * spacing / 2);

    actions.forEach((action, index) => {
        const x = startX + (index * spacing);
        const button = document.createElementNS(SVG_NS, "g");
        button.setAttribute("class", "node-action-button");
        button.dataset.nodeId = node.id;
        button.dataset.action = action.key;
        button.setAttribute("transform", `translate(${x}, ${node.y + 14})`);
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

        const rect = document.createElementNS(SVG_NS, "rect");
        rect.setAttribute("x", "-14");
        rect.setAttribute("y", "-14");
        rect.setAttribute("rx", "14");
        rect.setAttribute("ry", "14");
        rect.setAttribute("width", "28");
        rect.setAttribute("height", "28");
        button.appendChild(rect);

        const icon = document.createElementNS(SVG_NS, "text");
        icon.setAttribute("x", "0");
        icon.setAttribute("y", "0");
        icon.setAttribute("text-anchor", "middle");
        icon.setAttribute("dominant-baseline", "middle");
        icon.setAttribute("class", "node-action-icon");
        icon.textContent = action.label;
        button.appendChild(icon);

        const tooltip = document.createElementNS(SVG_NS, "title");
        tooltip.textContent = action.title;
        button.appendChild(tooltip);

        group.appendChild(button);
    });
}

function renderBranchLabel(node, cx, cy, x1, y1, x2, y2) {
    const branchText = (node.branchText || "").trim();
    if (!branchText) return;
    const label = document.createElementNS(SVG_NS, "text");
    label.setAttribute("class", "branch-label");
    label.setAttribute("x", String(cx));
    label.setAttribute("y", String(cy - 6));
    label.setAttribute("text-anchor", "middle");
    label.textContent = truncate(branchText, 26);
    if (isSketchPreset()) {
        label.classList.add("branch-label-sketch");
    }
    const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
    label.setAttribute("transform", `rotate(${Math.max(-24, Math.min(24, angle))}, ${cx}, ${cy - 6})`);
    label.addEventListener("mousedown", event => event.stopPropagation());
    label.addEventListener("click", async event => {
        event.stopPropagation();
        await quickEditBranchText(node.id);
    });
    svg.appendChild(label);
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
    const base = normalizeNodeText(node.text || "Nodo");
    return base
        .split("\n")
        .map(line => truncate(line, maxLineLength));
}

function normalizeNodeEmoji(value) {
    const emoji = (value || "").trim();
    return emoji.length ? [...emoji].slice(0, 2).join("") : "";
}

function selectNode(nodeId) {
    state.selectedNodeId = nodeId;
    const node = getNodeById(nodeId);
    if (!node) return;
    textInput.value = node.text || "";
    nodeEmojiInput.value = node.emoji || "";
    branchTextInput.value = node.branchText || "";
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
    if (hasNodeImage(node)) {
        node.emoji = "";
        nodeEmojiInput.value = "";
    }
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
        node.emoji = "";
        nodeEmojiInput.value = "";
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

const autosubmitFields = [textInput, nodeEmojiInput, branchTextInput, colorInput, branchColorInput, branchStyleInput, fontSizeInput, imageUrlInput];
for (const field of autosubmitFields) {
    const eventName = field === textInput || field === imageUrlInput ? "input" : "change";
    field.addEventListener(eventName, () => queueAutoSubmitSelectedNode());
}
imageWidthInput.addEventListener("change", () => queueAutoSubmitSelectedNode());
imageHeightInput.addEventListener("change", () => queueAutoSubmitSelectedNode());
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
    node.emoji = normalizeNodeEmoji(nodeEmojiInput.value);
    node.branchText = (branchTextInput.value || "").trim();
    node.color = colorInput.value;
    node.branchColor = branchColorInput.value;
    node.branchStyle = branchStyleInput.value;
    node.fontSize = Number(fontSizeInput.value);
    node.imageUri = normalizeImageUri(imageUrlInput.value);
    node.imageWidth = clampImageSize(Number(imageWidthInput.value));
    node.imageHeight = clampImageSize(Number(imageHeightInput.value));
    if (hasNodeImage(node)) {
        node.emoji = "";
    } else if (hasNodeEmoji(node)) {
        node.imageUri = null;
    }
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
        emoji: null,
        branchText: null,
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

mapStyleInput.addEventListener("change", async () => {
    state.map.stylePreset = mapStyleInput.value;
    render();
    await saveMapStyle(mapStyleInput.value);
});

autoLayoutBtn.addEventListener("click", async () => {
    applyOrganicLayout();
    render();
    await persistAllNodePositions();
});

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

async function saveMapStyle(stylePreset) {
    await fetch(`/api/maps/${state.map.id}/style`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stylePreset })
    });
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

async function fetchMap() {
    const response = await fetch(`/api/maps/${state.map.id}`);
    return response.json();
}

function startImageUploadForNode(nodeId) {
    state.pendingImageNodeId = nodeId;
    imageUploadInput.click();
}

function buildChildrenMap(nodes) {
    const children = new Map();
    for (const node of nodes) {
        if (node.parentId == null) continue;
        if (!children.has(node.parentId)) children.set(node.parentId, []);
        children.get(node.parentId).push(node);
    }
    return children;
}

function getSubtreeWeight(nodeId, childrenMap) {
    const children = childrenMap.get(nodeId) || [];
    if (!children.length) return 1;
    return children.reduce((sum, child) => sum + getSubtreeWeight(child.id, childrenMap), 0);
}

function applyOrganicLayout() {
    const nodes = state.map.nodes;
    if (!nodes.length) return;
    const roots = nodes.filter(node => node.parentId == null);
    if (!roots.length) return;
    const childrenMap = buildChildrenMap(nodes);

    const placeChildren = (node, startAngle, endAngle, depth) => {
        const children = childrenMap.get(node.id) || [];
        if (!children.length) return;
        const totalWeight = children.reduce((sum, child) => sum + getSubtreeWeight(child.id, childrenMap), 0);
        let cursor = startAngle;
        const radius = 150 + (depth * 145);

        for (const child of children) {
            const share = getSubtreeWeight(child.id, childrenMap) / Math.max(totalWeight, 1);
            const span = (endAngle - startAngle) * share;
            const angle = cursor + span / 2;
            const size = isSketchPreset() ? getSketchNodeSize(child) : getNodeSize(child);
            const jitter = isSketchPreset() ? (Math.sin(child.id * 11.13) * 12) : 0;
            child.x = Math.round(MAP_CENTER_X + (Math.cos(angle) * radius) + jitter - (size.width / 2));
            child.y = Math.round(MAP_CENTER_Y + (Math.sin(angle) * radius) + jitter - (size.height / 2));
            placeChildren(child, cursor + 0.06, cursor + span - 0.06, depth + 1);
            cursor += span;
        }
    };

    if (roots.length === 1) {
        const root = roots[0];
        const rootSize = isSketchPreset() ? getSketchNodeSize(root) : getNodeSize(root);
        root.x = Math.round(MAP_CENTER_X - rootSize.width / 2);
        root.y = Math.round(MAP_CENTER_Y - rootSize.height / 2);
        placeChildren(root, -Math.PI + 0.2, Math.PI - 0.2, 1);
        return;
    }

    const step = (Math.PI * 2) / roots.length;
    roots.forEach((root, index) => {
        const angle = (index * step) - Math.PI / 2;
        const rootSize = isSketchPreset() ? getSketchNodeSize(root) : getNodeSize(root);
        root.x = Math.round(MAP_CENTER_X + (Math.cos(angle) * 120) - rootSize.width / 2);
        root.y = Math.round(MAP_CENTER_Y + (Math.sin(angle) * 120) - rootSize.height / 2);
        placeChildren(root, angle - step / 2, angle + step / 2, 1);
    });
}

async function persistAllNodePositions() {
    for (const node of state.map.nodes) {
        await saveNode(node);
    }
}

async function addChildNode(parentId) {
    const parent = getNodeById(parentId);
    if (!parent) return;
    const branchText = window.prompt("Testo del ramo (facoltativo):", "") || "";
    const nodeText = window.prompt("Testo del nuovo nodo:", "Nuovo ramo") || "Nuovo ramo";
    const node = await createNode({
        parentId: parent.id,
        text: normalizeNodeText(nodeText),
        emoji: null,
        branchText: branchText.trim(),
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

async function quickEditBranchText(nodeId) {
    const node = getNodeById(nodeId);
    if (!node) return;
    const value = window.prompt("Inserisci il testo del ramo:", node.branchText || "");
    if (value === null) return;
    node.branchText = value.trim();
    selectNode(nodeId);
    render();
    await saveNode(node);
}

async function quickEditEmoji(nodeId) {
    const node = getNodeById(nodeId);
    if (!node) return;
    const value = window.prompt("Inserisci una emoji per il nodo:", node.emoji || "");
    if (value === null) return;
    node.emoji = normalizeNodeEmoji(value);
    if (node.emoji) {
        node.imageUri = null;
        imageUrlInput.value = "";
        updateImagePreview("");
    }
    selectNode(nodeId);
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

mapStyleInput.value = (state.map.stylePreset || "CLASSIC").toUpperCase();
selectNode(state.map.nodes[0]?.id ?? null);
render();
