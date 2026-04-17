package com.example.mindmap.controller;

import com.example.mindmap.dto.CreateNodeRequest;
import com.example.mindmap.dto.MindMapDto;
import com.example.mindmap.dto.NodeDto;
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
                    html.append("<line class='line' x1='").append(parent.getX() + 90).append("' y1='").append(parent.getY() + 32)
                            .append("' x2='").append(node.getX() + 90).append("' y2='").append(node.getY() + 32).append("' />");
                }
            }
        }
        for (var node : map.getNodes()) {
            html.append("<g class='node'><rect x='").append(node.getX()).append("' y='").append(node.getY())
                    .append("' rx='18' ry='18' width='180' height='64' fill='").append(escape(node.getColor()))
                    .append("' stroke='#555' stroke-width='1.2'/><text x='").append(node.getX() + 90).append("' y='").append(node.getY() + 34)
                    .append("' font-size='").append(node.getFontSize()).append("'>")
                    .append(escape(node.getText())).append("</text></g>");
        }
        html.append("</svg></body></html>");
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=mappa-" + id + ".html")
                .body(html.toString());
    }

    private String escape(String value) {
        if (value == null) return "";
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;").replace("'", "&#39;");
    }
}
