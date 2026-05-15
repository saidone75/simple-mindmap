package org.saidone.mindmaps.service;

import lombok.val;
import org.saidone.mindmaps.dto.MindMapDto;
import org.saidone.mindmaps.dto.NodeDto;
import org.springframework.stereotype.Component;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.geom.RoundRectangle2D;
import java.awt.image.BufferedImage;
import java.io.InputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Comparator;
import java.util.List;
import java.util.function.Function;
import java.util.stream.Collectors;

@Component
public class MindMapExportRenderer {

    public BufferedImage renderMapImage(MindMapDto map) {
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
                    val nodeImage = readNodeImage(node.getImageUri());
                    if (nodeImage != null) g.drawImage(nodeImage, x + (nodeW - 42) / 2, y + 12, 42, 42, null);
                } catch (Exception ignored) {
                }
            }

            String emoji = normalize(node.getEmoji());
            int topPadding = 14;
            if (!emoji.isBlank() && !hasImage(node)) {
                g.setFont(new Font("Dialog", Font.PLAIN, Math.max(16, node.getFontSize() + 2)));
                val em = g.getFontMetrics();
                g.setColor(Color.BLACK);
                g.drawString(emoji, x + (nodeW - em.stringWidth(emoji)) / 2, y + topPadding + em.getAscent());
                topPadding += em.getHeight() + 2;
            } else if (hasImage(node)) {
                topPadding = 58;
            }

            g.setFont(new Font("SansSerif", Font.BOLD, node.getFontSize()));
            g.setColor(Color.BLACK);
            String title = normalize(node.getText());
            String description = normalize(node.getDescription());
            int contentWidth = nodeW - 18;
            int textY = y + topPadding;
            for (String line : wrapText(title, g.getFontMetrics(), contentWidth, 2)) {
                val fm = g.getFontMetrics();
                g.drawString(line, x + (nodeW - fm.stringWidth(line)) / 2, textY + fm.getAscent());
                textY += fm.getHeight();
            }
            if (!description.isBlank()) {
                g.setFont(new Font("SansSerif", Font.PLAIN, Math.max(11, (int) Math.round(node.getFontSize() * 0.75))));
                val dfm = g.getFontMetrics();
                g.setColor(new Color(58, 58, 58));
                for (String line : wrapText(description, dfm, contentWidth, hasImage(node) ? 2 : 3)) {
                    if (textY + dfm.getHeight() > y + nodeH - 6) break;
                    g.drawString(line, x + (nodeW - dfm.stringWidth(line)) / 2, textY + dfm.getAscent());
                    textY += dfm.getHeight();
                }
            }
        }
        g.dispose();
        return image;
    }



    public byte[] renderMapPdf(MindMapDto map, String format) throws Exception {
        val image = renderMapImage(map);
        val pageRect = "a3".equalsIgnoreCase(format) ? org.apache.pdfbox.pdmodel.common.PDRectangle.A3 : org.apache.pdfbox.pdmodel.common.PDRectangle.A4;
        try (val document = new org.apache.pdfbox.pdmodel.PDDocument(); val imageBytes = new java.io.ByteArrayOutputStream()) {
            ImageIO.write(image, "jpg", imageBytes);
            val page = new org.apache.pdfbox.pdmodel.PDPage(new org.apache.pdfbox.pdmodel.common.PDRectangle(pageRect.getHeight(), pageRect.getWidth()));
            document.addPage(page);
            val pdImage = org.apache.pdfbox.pdmodel.graphics.image.JPEGFactory.createFromByteArray(document, imageBytes.toByteArray());
            try (val stream = new org.apache.pdfbox.pdmodel.PDPageContentStream(document, page)) {
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
            val out = new java.io.ByteArrayOutputStream();
            document.save(out);
            return out.toByteArray();
        }
    }

    public String normalizePdfFormat(String format) {
        return "a3".equalsIgnoreCase(format) ? "a3" : "a4";
    }
    public String slugify(String value) {
        if (value == null || value.isBlank()) return "mappa";
        return value.toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
    }

    private BufferedImage readNodeImage(String imageUri) {
        if (imageUri == null || imageUri.isBlank()) return null;
        try {
            if (imageUri.startsWith("data:image/")) {
                int commaIndex = imageUri.indexOf(',');
                if (commaIndex <= 0) return null;
                byte[] bytes = Base64.getDecoder().decode(imageUri.substring(commaIndex + 1).getBytes(StandardCharsets.UTF_8));
                return ImageIO.read(new java.io.ByteArrayInputStream(bytes));
            }
            val connection = URI.create(imageUri).toURL().openConnection();
            connection.setConnectTimeout(4000);
            connection.setReadTimeout(5000);
            connection.setRequestProperty("User-Agent", "simple-mindmaps-export/1.0");
            try (InputStream in = connection.getInputStream()) {
                return ImageIO.read(in);
            }
        } catch (Exception ignored) {
            return null;
        }
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim();
    }

    private List<String> wrapText(String text, FontMetrics metrics, int maxWidth, int maxLines) {
        if (text == null || text.isBlank()) return List.of();
        val words = text.trim().split("\\s+");
        val lines = new java.util.ArrayList<String>();
        StringBuilder current = new StringBuilder();
        for (String word : words) {
            String candidate = current.isEmpty() ? word : current + " " + word;
            if (metrics.stringWidth(candidate) <= maxWidth) {
                current.setLength(0);
                current.append(candidate);
            } else {
                if (!current.isEmpty()) lines.add(current.toString());
                current.setLength(0);
                current.append(word);
                if (lines.size() == maxLines - 1) break;
            }
        }
        if (!current.isEmpty() && lines.size() < maxLines) lines.add(current.toString());
        return lines;
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
}
