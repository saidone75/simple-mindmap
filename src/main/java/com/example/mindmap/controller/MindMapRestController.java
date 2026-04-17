package com.example.mindmap.controller;

import com.example.mindmap.dto.CreateNodeRequest;
import com.example.mindmap.dto.MindMapDto;
import com.example.mindmap.dto.NodeDto;
import com.example.mindmap.dto.UpdateMapStyleRequest;
import com.example.mindmap.dto.UpdateNodeRequest;
import com.example.mindmap.service.MindMapService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class MindMapRestController {

    private final MindMapService mindMapService;

    public MindMapRestController(MindMapService mindMapService) {
        this.mindMapService = mindMapService;
    }

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

    @DeleteMapping("/nodes/{nodeId}")
    public void deleteNode(@PathVariable Long nodeId) {
        mindMapService.deleteNode(nodeId);
    }

    @GetMapping(value = "/maps/{id}/export", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> exportHtml(@PathVariable Long id) {
        MindMapDto map = mindMapService.findMapWithNodes(id);
        StringBuilder html = new StringBuilder();
        html.append("<!DOCTYPE html><html lang='it'><head><meta charset='UTF-8'><title>")
                .append(escape(map.getTitle()))
                .append("</title><style>body{font-family:Arial,sans-serif;background:#fff;margin:0;padding:20px;}svg{width:1400px;height:900px;} .line{stroke:#777;stroke-width:2}.node text{font-weight:600;dominant-baseline:middle;text-anchor:middle;}</style></head><body>");
        html.append("<h1>").append(escape(map.getTitle())).append("</h1>");
        html.append("<svg viewBox='0 0 1400 900' xmlns='http://www.w3.org/2000/svg'>");
        for (var node : map.getNodes()) {
            if (node.getParentId() != null) {
                var parent = map.getNodes().stream().filter(n -> n.getId().equals(node.getParentId())).findFirst().orElse(null);
                if (parent != null) {
                    int parentW = hasImage(parent) ? 220 : 180;
                    int parentH = hasImage(parent) ? 100 : 64;
                    int nodeW = hasImage(node) ? 220 : 180;
                    int nodeH = hasImage(node) ? 100 : 64;
                    html.append("<line class='line' x1='").append(parent.getX() + parentW / 2).append("' y1='").append(parent.getY() + parentH / 2)
                            .append("' x2='").append(node.getX() + nodeW / 2).append("' y2='").append(node.getY() + nodeH / 2).append("' />");
                }
            }
        }
        for (var node : map.getNodes()) {
            int width = hasImage(node) ? 220 : 180;
            int height = hasImage(node) ? 100 : 64;
            html.append("<g class='node'><rect x='").append(node.getX()).append("' y='").append(node.getY())
                    .append("' rx='18' ry='18' width='").append(width).append("' height='").append(height).append("' fill='").append(escape(node.getColor()))
                    .append("' stroke='#555' stroke-width='1.2'/>");
            if (hasImage(node)) {
                html.append("<image href='").append(escape(node.getImageUri())).append("' x='").append(node.getX() + (width - 42) / 2)
                        .append("' y='").append(node.getY() + 12).append("' width='42' height='42' preserveAspectRatio='xMidYMid slice'/>");
            }
            html.append("<text x='").append(node.getX() + width / 2).append("' y='")
                    .append(hasImage(node) ? node.getY() + height - 18 : node.getY() + 34)
                    .append("' font-size='").append(node.getFontSize()).append("'>")
                    .append(escape(node.getText())).append("</text></g>");
        }
        html.append("</svg></body></html>");
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=mappa-" + id + ".html")
                .body(html.toString());
    }

    private boolean hasImage(NodeDto node) {
        return node.getImageUri() != null && !node.getImageUri().isBlank();
    }

    private String escape(String value) {
        if (value == null) return "";
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;").replace("'", "&#39;");
    }
}
