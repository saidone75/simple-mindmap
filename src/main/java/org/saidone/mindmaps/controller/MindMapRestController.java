/*
 * Alice's Simple Mind Maps
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

package org.saidone.mindmaps.controller;

import lombok.RequiredArgsConstructor;
import lombok.val;
import org.saidone.mindmaps.dto.*;
import org.saidone.mindmaps.service.MindMapService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.function.Function;
import java.util.stream.Collectors;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api")
public class MindMapRestController {

    private final MindMapService mindMapService;

    @GetMapping("/maps/{id}")
    public MindMapDto getMap(@PathVariable Long id) {
        return mindMapService.findMapWithNodes(id);
    }

    @PostMapping("/maps/{id}/nodes")
    public NodeDto addNode(@PathVariable Long id, @RequestBody CreateNodeRequest request) {
        return mindMapService.addNode(id, request);
    }

    @PutMapping("/nodes/{nodeId}")
    public NodeDto updateNode(@PathVariable Long nodeId, @RequestBody UpdateNodeRequest request) {
        return mindMapService.updateNode(nodeId, request);
    }

    @PutMapping("/maps/{id}/style")
    public MindMapDto updateMapStyle(@PathVariable Long id, @RequestBody UpdateMapStyleRequest request) {
        return mindMapService.updateMapStyle(id, request.getStylePreset());
    }

    @PutMapping("/maps/{id}/title")
    public MindMapDto updateMapTitle(@PathVariable Long id, @RequestBody UpdateMapTitleRequest request) {
        return mindMapService.updateMapTitle(id, request.getTitle());
    }

    @DeleteMapping("/nodes/{nodeId}")
    public void deleteNode(@PathVariable Long nodeId) {
        mindMapService.deleteNode(nodeId);
    }

    @GetMapping(value = "/maps/{id}/export", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> exportHtml(@PathVariable Long id) {
        val map = mindMapService.findMapWithNodes(id);
        val nodesById = map.getNodes().stream().collect(Collectors.toMap(NodeDto::getId, Function.identity()));
        val connections = map.getNodes().stream()
                .filter(node -> node.getParentId() != null)
                .map(node -> {
                    val parent = nodesById.get(node.getParentId());
                    return parent == null ? "" : buildConnectionLine(parent, node);
                })
                .collect(Collectors.joining());

        val nodes = map.getNodes().stream().map(this::buildNodeMarkup).collect(Collectors.joining());

        val html = """
                <!DOCTYPE html><html lang='it'><head><meta charset='UTF-8'><title>%s</title>
                <style>body{font-family:Arial,sans-serif;background:#fff;margin:0;padding:20px;}svg{width:1400px;height:900px;} .line{stroke:#777;stroke-width:2}.node text{font-weight:600;dominant-baseline:middle;text-anchor:middle;}</style>
                </head><body><h1>%s</h1><svg viewBox='0 0 1400 900' xmlns='http://www.w3.org/2000/svg'>%s%s</svg></body></html>
                """.formatted(escape(map.getTitle()), escape(map.getTitle()), connections, nodes);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, String.format("attachment; filename=mappa-%d.html", id))
                .body(html);
    }

    private String buildConnectionLine(NodeDto parent, NodeDto node) {
        int parentW = hasImage(parent) ? 220 : 180;
        int parentH = hasImage(parent) ? 100 : 64;
        int nodeW = hasImage(node) ? 220 : 180;
        int nodeH = hasImage(node) ? 100 : 64;

        return "<line class='line' x1='%d' y1='%d' x2='%d' y2='%d' />"
                .formatted(parent.getX() + parentW / 2, parent.getY() + parentH / 2, node.getX() + nodeW / 2, node.getY() + nodeH / 2);
    }

    private String buildNodeMarkup(NodeDto node) {
        int width = hasImage(node) ? 220 : 180;
        int height = hasImage(node) ? 100 : 64;

        val imageMarkup = hasImage(node)
                ? "<image href='%s' x='%d' y='%d' width='42' height='42' preserveAspectRatio='xMidYMid slice'/>"
                .formatted(escape(node.getImageUri()), node.getX() + (width - 42) / 2, node.getY() + 12)
                : "";

        return """
                <g class='node'><rect x='%d' y='%d' rx='18' ry='18' width='%d' height='%d' fill='%s' stroke='#555' stroke-width='1.2'/>%s
                <text x='%d' y='%d' font-size='%d'>%s</text></g>
                """.formatted(
                node.getX(), node.getY(), width, height, escape(node.getColor()), imageMarkup,
                node.getX() + width / 2, hasImage(node) ? node.getY() + height - 18 : node.getY() + 34,
                node.getFontSize(), escape(node.getText())
        );
    }

    private boolean hasImage(NodeDto node) {
        return node.getImageUri() != null && !node.getImageUri().isBlank();
    }

    private String escape(String value) {
        if (value == null) return "";
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;").replace("'", "&#39;");
    }
}
