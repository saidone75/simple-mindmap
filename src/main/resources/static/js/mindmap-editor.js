/*
 * Alice's Simple Mind Map
 * Copyright (C) 2026 Miss Alice & Saidone
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

const SVG_NS = "http://www.w3.org/2000/svg";
const BASE_NODE_WIDTH = 180;
const BASE_NODE_HEIGHT = 64;
const IMAGE_NODE_WIDTH = 220;
const IMAGE_NODE_HEIGHT = 110;
const DEFAULT_IMAGE_SIZE = 128;
const MIN_IMAGE_SIZE = 24;
const MAX_IMAGE_SIZE = 240;
const MIN_NODE_WIDTH = 120;
const MAX_NODE_WIDTH = 720;
const MIN_NODE_HEIGHT = 60;
const MAX_NODE_HEIGHT = 420;
const MAP_CENTER_X = 700;
const MAP_CENTER_Y = 450;
const BASE_CANVAS_WIDTH = 1400;
const BASE_CANVAS_HEIGHT = 900;
const CANVAS_PADDING = 180;
const MIN_ZOOM_PERCENT = 10;
const MAX_ZOOM_PERCENT = 200;

const state = {
    map: structuredClone(initialMap),
    selectedNodeId: null,
    drag: null,
    resize: null,
    pendingImageNodeId: null,
    autosaveTimer: null,
    autosaveNodeId: null,
    autosavePromise: null,
    contextMenu: null,
    hoveredNodeId: null,
    hoverHideTimer: null,
};

const svg = document.getElementById("mindmap-canvas");
const textInput = document.getElementById("node-text");
const descriptionInput = document.getElementById("node-description");
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
const autoLayoutBtn = document.getElementById("auto-layout-btn");
const zoomInput = document.getElementById("zoom-control");
const zoomValue = document.getElementById("zoom-value");
const canvasPanel = svg.closest(".canvas-panel");

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
    const baseSize = hasNodeImage(node)
        ? {
            width: Math.max(IMAGE_NODE_WIDTH, imageSize.width + 60),
            height: Math.max(IMAGE_NODE_HEIGHT, imageSize.height + textBlockHeight + 44)
        }
        : { width: BASE_NODE_WIDTH, height: Math.max(BASE_NODE_HEIGHT, textBlockHeight + 34) };
    const customWidth = clampNodeWidth(Number(node.nodeWidth));
    const customHeight = clampNodeHeight(Number(node.nodeHeight));
    return {
        width: Math.max(baseSize.width, customWidth),
        height: Math.max(baseSize.height, customHeight)
    };
}

function getNodeImageSize(node) {
    return {
        width: clampImageSize(Number(node.imageWidth) || DEFAULT_IMAGE_SIZE),
        height: clampImageSize(Number(node.imageHeight) || DEFAULT_IMAGE_SIZE),
    };
}

function isSketchPreset() {
    return false;
}

function getSketchNodeSize(node) {
    const lines = getNodeDisplayLines(node, 24);
    const longest = lines.reduce((max, line) => Math.max(max, (line.text || "").length), 0);
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

        if (!sketchPreset && node.id === state.hoveredNodeId) {
            renderNodeActionButtons(group, node, width);
        }
        if (!sketchPreset && node.id === state.selectedNodeId) {
            renderNodeResizeHandle(group, node, width, height);
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
        const descriptionFontSize = Math.max(12, Math.round(fontSize * 0.78));
        lines.forEach((line, index) => {
            const tspan = document.createElementNS(SVG_NS, "tspan");
            tspan.setAttribute("x", node.x + width / 2);
            tspan.setAttribute("dy", index === 0 ? "0" : String(lineHeight));
            if (line.isDescription) {
                tspan.setAttribute("font-size", String(descriptionFontSize));
                tspan.setAttribute("font-weight", "500");
            }
            tspan.textContent = line.text || " ";
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
        group.addEventListener("mouseenter", () => {
            if (state.hoverHideTimer) {
                clearTimeout(state.hoverHideTimer);
                state.hoverHideTimer = null;
            }
            if (state.hoveredNodeId === node.id) return;
            state.hoveredNodeId = node.id;
            render();
        });
        group.addEventListener("mouseleave", () => {
            if (state.hoveredNodeId !== node.id) return;
            if (state.hoverHideTimer) {
                clearTimeout(state.hoverHideTimer);
            }
            state.hoverHideTimer = setTimeout(() => {
                state.hoveredNodeId = null;
                state.hoverHideTimer = null;
                render();
            }, 1800);
        });
        group.addEventListener("contextmenu", event => openContextMenu(event, node.id));
        svg.appendChild(group);
    }
    applyCanvasViewport();
}

function openContextMenu(event, nodeId) {
    event.preventDefault();
    event.stopPropagation();
    selectNode(nodeId);
    closeContextMenu();
    if (typeof window.tippy !== "function") return;

    const anchor = document.createElement("span");
    anchor.className = "context-menu-anchor";
    anchor.style.left = `${event.clientX}px`;
    anchor.style.top = `${event.clientY}px`;
    document.body.appendChild(anchor);

    const content = document.createElement("div");
    content.className = "node-context-menu";
    content.innerHTML = `
        <button type="button" data-action="add-child">➕ Aggiungi figlio</button>
        <button type="button" data-action="edit-text">✏️ Modifica testo</button>
        <button type="button" data-action="edit-branch">🌿 Modifica ramo</button>
        <button type="button" data-action="upload-image">🖼️ Aggiungi immagine</button>
        <button type="button" data-action="delete" class="danger">🗑️ Elimina nodo</button>
    `;

    const instance = window.tippy(anchor, {
        content,
        trigger: "manual",
        interactive: true,
        placement: "right-start",
        theme: "light-border",
        appendTo: () => document.body,
        hideOnClick: true,
        onHidden(inst) {
            inst.destroy();
            anchor.remove();
            if (state.contextMenu?.instance === inst) {
                state.contextMenu = null;
            }
        }
    });
    instance.show();
    state.contextMenu = { instance, anchor };

    content.addEventListener("click", async actionEvent => {
        const action = actionEvent.target?.dataset?.action;
        if (!action) return;
        if (action === "add-child") await addChildNode(nodeId);
        if (action === "edit-text") await quickEdit(nodeId);
        if (action === "edit-branch") await quickEditBranchText(nodeId);
        if (action === "upload-image") startImageUploadForNode(nodeId);
        if (action === "delete") await deleteNodeWithChecks(nodeId);
        closeContextMenu();
    });
}

function closeContextMenu() {
    const menu = state.contextMenu;
    if (!menu) return;
    menu.instance.hide();
}

function getCanvasBounds() {
    let minX = 0;
    let minY = 0;
    let maxX = BASE_CANVAS_WIDTH - CANVAS_PADDING;
    let maxY = BASE_CANVAS_HEIGHT - CANVAS_PADDING;
    for (const node of state.map.nodes) {
        const nodeSize = isSketchPreset() ? getSketchNodeSize(node) : getNodeSize(node);
        minX = Math.min(minX, node.x);
        minY = Math.min(minY, node.y);
        maxX = Math.max(maxX, node.x + nodeSize.width);
        maxY = Math.max(maxY, node.y + nodeSize.height);
    }
    const viewportX = Math.floor(minX - CANVAS_PADDING);
    const viewportY = Math.floor(minY - CANVAS_PADDING);
    const width = Math.max(BASE_CANVAS_WIDTH, Math.ceil(maxX - minX + (CANVAS_PADDING * 2)));
    const height = Math.max(BASE_CANVAS_HEIGHT, Math.ceil(maxY - minY + (CANVAS_PADDING * 2)));

    return { x: viewportX, y: viewportY, width, height };
}

function applyCanvasViewport() {
    const zoomPercent = Number(zoomInput?.value) || 100;
    const clampedZoomPercent = Math.min(MAX_ZOOM_PERCENT, Math.max(MIN_ZOOM_PERCENT, zoomPercent));
    if (zoomInput && Number(zoomInput.value) !== clampedZoomPercent) {
        zoomInput.value = String(clampedZoomPercent);
    }
    const zoomFactor = clampedZoomPercent / 100;
    const { x, y, width, height } = getCanvasBounds();

    svg.setAttribute("viewBox", `${x} ${y} ${width} ${height}`);
    svg.setAttribute("width", String(Math.round(width * zoomFactor)));
    svg.setAttribute("height", String(Math.round(height * zoomFactor)));
    if (zoomValue) {
        zoomValue.textContent = `${clampedZoomPercent}%`;
    }
}


function focusCanvasOnContent() {
    if (!canvasPanel) return;
    const zoomPercent = Number(zoomInput?.value) || 100;
    const zoomFactor = Math.min(MAX_ZOOM_PERCENT, Math.max(MIN_ZOOM_PERCENT, zoomPercent)) / 100;
    const { x, y, width, height } = getCanvasBounds();

    const centerX = (x + width / 2) * zoomFactor;
    const centerY = (y + height / 2) * zoomFactor;

    canvasPanel.scrollLeft = Math.max(0, Math.round(centerX - (canvasPanel.clientWidth / 2)));
    canvasPanel.scrollTop = Math.max(0, Math.round(centerY - (canvasPanel.clientHeight / 2)));
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
    const actionRowY = node.y - 18;
    const startX = node.x + (nodeWidth / 2) - ((actions.length - 1) * spacing / 2);

    actions.forEach((action, index) => {
        const x = startX + (index * spacing);
        const button = document.createElementNS(SVG_NS, "g");
        button.setAttribute("class", "node-action-button");
        button.dataset.nodeId = node.id;
        button.dataset.action = action.key;
        button.setAttribute("transform", `translate(${x}, ${actionRowY})`);
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

function renderNodeResizeHandle(group, node, nodeWidth, nodeHeight) {
    const handle = document.createElementNS(SVG_NS, "circle");
    handle.setAttribute("class", "node-resize-handle");
    handle.setAttribute("cx", node.x + nodeWidth - 3);
    handle.setAttribute("cy", node.y + nodeHeight - 3);
    handle.setAttribute("r", "8");
    handle.dataset.nodeId = node.id;
    handle.addEventListener("mousedown", startNodeResize);
    group.appendChild(handle);
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
    const normalized = sanitizePlainText((value || "")
        .replace(/\r\n/g, "\n")
        .replace(/\u00a0/g, " ")
        .trim());
    return normalized.length ? normalized : "Nodo";
}

function sanitizePlainText(value) {
    return (value || "")
        .replace(/[<>]/g, "")
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
}

function getNodeDisplayLines(node, maxLineLength) {
    const title = normalizeNodeText(node.text || "Nodo");
    const description = normalizeNodeText(node.description || "");
    const titleLines = wrapTextByWords(title, maxLineLength).map(line => ({ text: line, isDescription: false }));
    const descriptionLines = description
        ? wrapTextByWords(description, Math.max(12, maxLineLength + 6))
            .map((line, idx) => ({ text: idx === 0 ? `— ${line}` : line, isDescription: true }))
        : [];
    return [...titleLines, ...descriptionLines];
}

function wrapTextByWords(value, maxLineLength) {
    const words = (value || "").split(/\s+/).filter(Boolean);
    if (!words.length) return [" "];
    const lines = [];
    let current = words[0];
    for (let i = 1; i < words.length; i++) {
        const candidate = `${current} ${words[i]}`;
        if (candidate.length <= maxLineLength) {
            current = candidate;
        } else {
            lines.push(current);
            current = words[i];
        }
    }
    lines.push(current);
    return lines;
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
    descriptionInput.value = node.description || "";
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
        mode: "image",
        nodeId,
        anchorX: bounds.x,
        anchorY: bounds.y,
        pointerOffsetX: bounds.x + bounds.width - point.x,
        pointerOffsetY: bounds.y + bounds.height - point.y,
    };
}

function startNodeResize(event) {
    event.stopPropagation();
    event.preventDefault();
    const nodeId = Number(event.currentTarget.dataset.nodeId);
    const node = getNodeById(nodeId);
    if (!node) return;

    selectNode(nodeId);
    const size = getNodeSize(node);
    const point = toSvgPoint(event);
    state.resize = {
        mode: "node",
        nodeId,
        startX: node.x,
        startY: node.y,
        pointerOffsetX: node.x + size.width - point.x,
        pointerOffsetY: node.y + size.height - point.y,
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
    if (state.resize.mode === "node") {
        const intrinsic = getIntrinsicNodeSize(node);
        node.nodeWidth = clampNodeWidth(point.x - state.resize.startX + state.resize.pointerOffsetX);
        node.nodeHeight = clampNodeHeight(point.y - state.resize.startY + state.resize.pointerOffsetY);
        node.nodeWidth = Math.max(node.nodeWidth, intrinsic.width);
        node.nodeHeight = Math.max(node.nodeHeight, intrinsic.height);
    } else {
        node.imageWidth = clampImageSize(point.x - state.resize.anchorX + state.resize.pointerOffsetX);
        node.imageHeight = clampImageSize(point.y - state.resize.anchorY + state.resize.pointerOffsetY);
        imageWidthInput.value = node.imageWidth;
        imageHeightInput.value = node.imageHeight;
        updateImageSizeLabels();
    }
    render();
    scheduleAutosave(node);
});

document.addEventListener("mouseup", () => {
    state.drag = null;
    state.resize = null;
});

document.addEventListener("click", event => {
    if (event.target.closest(".node-context-menu")) return;
    closeContextMenu();
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

const autosubmitFields = [textInput, descriptionInput, nodeEmojiInput, branchTextInput, colorInput, branchColorInput, branchStyleInput, fontSizeInput, imageUrlInput];
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
    node.description = normalizeNodeText(descriptionInput.value || "").slice(0, 280);
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
    if (!trimmed.length) return null;
    if (trimmed.startsWith("data:image/")) return trimmed;
    try {
        const parsed = new URL(trimmed);
        if (parsed.protocol === "http:" || parsed.protocol === "https:") {
            return parsed.toString();
        }
    } catch (error) {
        return null;
    }
    return null;
}

function clampImageSize(value) {
    if (!Number.isFinite(value) || value <= 0) return DEFAULT_IMAGE_SIZE;
    return Math.min(MAX_IMAGE_SIZE, Math.max(MIN_IMAGE_SIZE, Math.round(value)));
}

function ensureNodeImageSize(node) {
    node.imageWidth = clampImageSize(Number(node.imageWidth));
    node.imageHeight = clampImageSize(Number(node.imageHeight));
}

function getIntrinsicNodeSize(node) {
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

function clampNodeWidth(value) {
    if (!Number.isFinite(value)) return BASE_NODE_WIDTH;
    return Math.min(MAX_NODE_WIDTH, Math.max(MIN_NODE_WIDTH, Math.round(value)));
}

function clampNodeHeight(value) {
    if (!Number.isFinite(value)) return BASE_NODE_HEIGHT;
    return Math.min(MAX_NODE_HEIGHT, Math.max(MIN_NODE_HEIGHT, Math.round(value)));
}

function updateImageSizeLabels() {
    imageWidthValue.textContent = imageWidthInput.value;
    imageHeightValue.textContent = imageHeightInput.value;
}

document.getElementById("add-root-btn").addEventListener("click", async () => {
    const node = await createNode({
        parentId: null,
        text: "Nuovo nodo",
        description: "Breve descrizione del nodo.",
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
        imageHeight: DEFAULT_IMAGE_SIZE,
        nodeWidth: BASE_NODE_WIDTH,
        nodeHeight: BASE_NODE_HEIGHT
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
if (zoomInput) {
    zoomInput.addEventListener("input", () => applyCanvasViewport());
}

autoLayoutBtn.addEventListener("click", async () => {
    applyOrganicLayout();
    render();
    focusCanvasOnContent();
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
    state.autosaveNodeId = node.id;
    state.autosaveTimer = setTimeout(() => {
        const pendingNode = getNodeById(state.autosaveNodeId);
        state.autosaveTimer = null;
        state.autosaveNodeId = null;
        if (pendingNode) runAutosave(pendingNode);
    }, 500);
}

function runAutosave(node) {
    const promise = saveNode(node).finally(() => {
        if (state.autosavePromise === promise) {
            state.autosavePromise = null;
        }
    });
    state.autosavePromise = promise;
    return promise;
}

async function flushAutosave() {
    if (state.autosaveTimer && state.autosaveNodeId != null) {
        clearTimeout(state.autosaveTimer);
        const pendingNode = getNodeById(state.autosaveNodeId);
        state.autosaveTimer = null;
        state.autosaveNodeId = null;
        if (pendingNode) {
            await runAutosave(pendingNode);
        }
    }
    if (state.autosavePromise) {
        await state.autosavePromise;
    }
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

    resolveNodeOverlaps(nodes);
}

function resolveNodeOverlaps(nodes) {
    const padding = 28;
    for (let iteration = 0; iteration < 45; iteration += 1) {
        let moved = false;
        for (let i = 0; i < nodes.length; i += 1) {
            const first = nodes[i];
            const firstSize = getNodeSize(first);
            const firstCenterX = first.x + (firstSize.width / 2);
            const firstCenterY = first.y + (firstSize.height / 2);
            for (let j = i + 1; j < nodes.length; j += 1) {
                const second = nodes[j];
                const secondSize = getNodeSize(second);
                const secondCenterX = second.x + (secondSize.width / 2);
                const secondCenterY = second.y + (secondSize.height / 2);

                const overlapX = (firstSize.width + secondSize.width) / 2 + padding - Math.abs(firstCenterX - secondCenterX);
                const overlapY = (firstSize.height + secondSize.height) / 2 + padding - Math.abs(firstCenterY - secondCenterY);

                if (overlapX > 0 && overlapY > 0) {
                    moved = true;
                    if (overlapX < overlapY) {
                        const shiftX = overlapX / 2;
                        if (firstCenterX <= secondCenterX) {
                            first.x -= Math.round(shiftX);
                            second.x += Math.round(shiftX);
                        } else {
                            first.x += Math.round(shiftX);
                            second.x -= Math.round(shiftX);
                        }
                    } else {
                        const shiftY = overlapY / 2;
                        if (firstCenterY <= secondCenterY) {
                            first.y -= Math.round(shiftY);
                            second.y += Math.round(shiftY);
                        } else {
                            first.y += Math.round(shiftY);
                            second.y -= Math.round(shiftY);
                        }
                    }
                }
            }
        }
        if (!moved) break;
    }
}

async function persistAllNodePositions() {
    for (const node of state.map.nodes) {
        await saveNode(node);
    }
}

async function addChildNode(parentId) {
    const parent = getNodeById(parentId);
    if (!parent) return;
    const node = await createNode({
        parentId: parent.id,
        text: "Nuovo nodo",
        description: "Breve descrizione del nodo.",
        emoji: null,
        branchText: null,
        x: parent.x + 220,
        y: parent.y + 90,
        color: "#9FC5E8",
        fontSize: 18,
        shape: "ROUNDED",
        branchColor: "#7c8a9a",
        branchStyle: "SOLID",
        imageUri: null,
        imageWidth: DEFAULT_IMAGE_SIZE,
        imageHeight: DEFAULT_IMAGE_SIZE,
        nodeWidth: BASE_NODE_WIDTH,
        nodeHeight: BASE_NODE_HEIGHT
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
    await flushAutosave();
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
    node.branchText = sanitizePlainText(value.trim());
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

function isTypingTarget(target) {
    if (!target) return false;
    const tag = target.tagName?.toLowerCase();
    return tag === "input" || tag === "textarea" || target.isContentEditable;
}

document.addEventListener("keydown", async event => {
    if (isTypingTarget(event.target)) return;
    if (!state.selectedNodeId) return;
    const node = getNodeById(state.selectedNodeId);
    if (!node) return;

    if (event.key === "Tab" && !event.shiftKey) {
        event.preventDefault();
        await addChildNode(node.id);
        return;
    }

    if ((event.key === "Delete" || event.key === "Backspace") && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        await deleteNodeWithChecks(node.id);
        return;
    }

    if (event.key === "Enter" && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        await quickEdit(node.id);
    }
});

state.map.stylePreset = "CLASSIC";
selectNode(state.map.nodes[0]?.id ?? null);
render();
