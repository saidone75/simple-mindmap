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
import org.saidone.mindmaps.service.MindMapExportRenderer;
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
import java.io.ByteArrayOutputStream;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api")
public class MindMapRestController {

    private final MindMapService mindMapService;
    private final MindMapExportRenderer mindMapExportRenderer;

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
        val image = mindMapExportRenderer.renderMapImage(map);
        val output = new ByteArrayOutputStream();
        ImageIO.write(image, "png", output);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=%s.png".formatted(mindMapExportRenderer.slugify(map.getTitle())))
                .body(output.toByteArray());
    }

    @GetMapping(value = "/maps/{id}/export/pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> exportPdf(@PathVariable Long id, @RequestParam(defaultValue = "a4") String format) throws Exception {
        val map = mindMapService.findMapWithNodes(id);
        val image = mindMapExportRenderer.renderMapImage(map);
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
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=%s-%s.pdf".formatted(mindMapExportRenderer.slugify(map.getTitle()), pageRect == PDRectangle.A3 ? "a3" : "a4"))
                .body(pdfBytes);
    }

}
