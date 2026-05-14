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
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.graphics.image.JPEGFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.geom.RoundRectangle2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.util.Comparator;
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

    @GetMapping(value = "/maps/{id}/export/png", produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<byte[]> exportPng(@PathVariable Long id) throws Exception {
        val map = mindMapService.findMapWithNodes(id);
        val image = renderMapImage(map);
        val output = new ByteArrayOutputStream();
        ImageIO.write(image, "png", output);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=%s.png".formatted(slugify(map.getTitle())))
                .body(output.toByteArray());
    }

    @GetMapping(value = "/maps/{id}/export/pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> exportPdf(@PathVariable Long id, @RequestParam(defaultValue = "a4") String format) throws Exception {
        val map = mindMapService.findMapWithNodes(id);
        val image = renderMapImage(map);
        val pageRect = "a3".equalsIgnoreCase(format) ? PDRectangle.A3 : PDRectangle.A4;

        byte[] pdfBytes;
        try (val document = new PDDocument(); val imageBytes = new ByteArrayOutputStream()) {
            ImageIO.write(image, "jpg", imageBytes);
            val page = new PDPage(new PDRectangle(pageRect.getHeight(), pageRect.getWidth()));
            document.addPage(page);
            val pdImage = JPEGFactory.createFromByteArray(document, imageBytes.toByteArray());
            try (val stream = new PDPageContentStream(document, page)) {
                float margin = 24f;
                float usableW = page.getMediaBox().getWidth() - margin * 2;
                float usableH = page.getMediaBox().getHeight() - margin * 2;
                float scale = Math.min(usableW / image.getWidth(), usableH / image.getHeight());
                float drawW = image.getWidth() * scale;
                float drawH = image.getHeight() * scale;
                float x = (page.getMediaBox().getWidth() - drawW) / 2;
                float y = (page.getMediaBox().getHeight() - drawH) / 2;
                stream.drawImage(pdImage, x, y, drawW, drawH);
            }
            val out = new ByteArrayOutputStream();
            document.save(out);
            pdfBytes = out.toByteArray();
        }
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=%s-%s.pdf".formatted(slugify(map.getTitle()), pageRect == PDRectangle.A3 ? "a3" : "a4"))
                .body(pdfBytes);
    }

    private BufferedImage renderMapImage(MindMapDto map) throws Exception {
        int padding = 80;
        int minX = map.getNodes().stream().map(NodeDto::getX).min(Comparator.naturalOrder()).orElse(0);
        int minY = map.getNodes().stream().map(NodeDto::getY).min(Comparator.naturalOrder()).orElse(0);
        int maxX = map.getNodes().stream().mapToInt(n -> n.getX() + (hasImage(n) ? 220 : 180)).max().orElse(1400);
        int maxY = map.getNodes().stream().mapToInt(n -> n.getY() + (hasImage(n) ? 100 : 64)).max().orElse(900);
        int width = Math.max(1400, (maxX - minX) + padding * 2);
        int height = Math.max(900, (maxY - minY) + padding * 2);

        val image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        val g = image.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setColor(Color.WHITE);
        g.fillRect(0, 0, width, height);
        int offsetX = padding - minX;
        int offsetY = padding - minY;
        val nodesById = map.getNodes().stream().collect(Collectors.toMap(NodeDto::getId, Function.identity()));

        g.setStroke(new BasicStroke(2f));
        g.setColor(new Color(124, 138, 154));
        for (val node : map.getNodes()) {
            if (node.getParentId() == null) continue;
            val parent = nodesById.get(node.getParentId());
            if (parent == null) continue;
            int parentW = hasImage(parent) ? 220 : 180;
            int parentH = hasImage(parent) ? 100 : 64;
            int nodeW = hasImage(node) ? 220 : 180;
            int nodeH = hasImage(node) ? 100 : 64;
            g.drawLine(parent.getX() + offsetX + parentW / 2, parent.getY() + offsetY + parentH / 2,
                    node.getX() + offsetX + nodeW / 2, node.getY() + offsetY + nodeH / 2);
        }

        for (val node : map.getNodes()) {
            int nodeW = hasImage(node) ? 220 : 180;
            int nodeH = hasImage(node) ? 100 : 64;
            int x = node.getX() + offsetX;
            int y = node.getY() + offsetY;
            g.setColor(parseColor(node.getColor()));
            g.fill(new RoundRectangle2D.Float(x, y, nodeW, nodeH, 18, 18));
            g.setColor(new Color(85, 85, 85));
            g.setStroke(new BasicStroke(1.2f));
            g.draw(new RoundRectangle2D.Float(x, y, nodeW, nodeH, 18, 18));
            if (hasImage(node)) {
                try {
                    val nodeImage = ImageIO.read(URI.create(node.getImageUri()).toURL());
                    if (nodeImage != null) g.drawImage(nodeImage, x + (nodeW - 42) / 2, y + 12, 42, 42, null);
                } catch (Exception ignored) { }
            }
            g.setFont(new Font("SansSerif", Font.BOLD, node.getFontSize()));
            g.setColor(Color.BLACK);
            val fm = g.getFontMetrics();
            val text = node.getText() == null ? "" : node.getText();
            int tx = x + (nodeW - fm.stringWidth(text)) / 2;
            int ty = hasImage(node) ? (y + nodeH - 18) : (y + 34);
            g.drawString(text, tx, ty);
        }
        g.dispose();
        return image;
    }

    private boolean hasImage(NodeDto node) {
        return node.getImageUri() != null && !node.getImageUri().isBlank();
    }

    private Color parseColor(String hex) {
        try {
            return Color.decode(hex);
        } catch (Exception ignored) {
            return new Color(255, 217, 102);
        }
    }

    private String slugify(String value) {
        if (value == null || value.isBlank()) return "mappa";
        return value.toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
    }
}
