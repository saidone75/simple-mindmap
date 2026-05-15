package org.saidone.mindmaps.service;

import lombok.val;
import org.saidone.mindmaps.dto.MindMapDto;
import org.saidone.mindmaps.dto.NodeDto;
import org.springframework.stereotype.Component;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.geom.RoundRectangle2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Comparator;
import java.util.List;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

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
        g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
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
            int fontSize = resolveFontSize(node);
            int topPadding = 14;
            if (!emoji.isBlank() && !hasImage(node)) {
                g.setFont(new Font("Dialog", Font.PLAIN, Math.max(16, fontSize + 2)));
                val em = g.getFontMetrics();
                g.setColor(resolveTextColor(node.getColor()));
                g.drawString(emoji, x + (nodeW - em.stringWidth(emoji)) / 2, y + topPadding + em.getAscent());
                topPadding += em.getHeight() + 2;
            } else if (hasImage(node)) {
                topPadding = 58;
            }

            g.setFont(new Font("Dialog", Font.BOLD, fontSize));
            g.setColor(resolveTextColor(node.getColor()));
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
                g.setFont(new Font("Dialog", Font.PLAIN, Math.max(11, (int) Math.round(fontSize * 0.75))));
                val dfm = g.getFontMetrics();
                g.setColor(resolveSecondaryTextColor(node.getColor()));
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


    public byte[] renderSvgPng(String svg) throws Exception {
        if (svg == null || svg.isBlank()) throw new IllegalArgumentException("SVG vuoto");
        String sanitizedSvg = sanitizeSvgForBatik(svg);
        val transcoder = new org.apache.batik.transcoder.image.PNGTranscoder();
        val input = new org.apache.batik.transcoder.TranscoderInput(new ByteArrayInputStream(sanitizedSvg.getBytes(StandardCharsets.UTF_8)));
        val output = new ByteArrayOutputStream();
        val out = new org.apache.batik.transcoder.TranscoderOutput(output);
        transcoder.transcode(input, out);
        return output.toByteArray();
    }

    public byte[] renderSvgPdf(String svg, String format) throws Exception {
        byte[] pngBytes = renderSvgPng(svg);
        val image = ImageIO.read(new ByteArrayInputStream(pngBytes));
        val pageRect = "a3".equalsIgnoreCase(format) ? org.apache.pdfbox.pdmodel.common.PDRectangle.A3 : org.apache.pdfbox.pdmodel.common.PDRectangle.A4;
        try (val document = new org.apache.pdfbox.pdmodel.PDDocument()) {
            val page = new org.apache.pdfbox.pdmodel.PDPage(new org.apache.pdfbox.pdmodel.common.PDRectangle(pageRect.getHeight(), pageRect.getWidth()));
            document.addPage(page);
            val jpegOut = new ByteArrayOutputStream();
            ImageIO.write(image, "jpg", jpegOut);
            val pdImage = org.apache.pdfbox.pdmodel.graphics.image.JPEGFactory.createFromByteArray(document, jpegOut.toByteArray());
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
            val out = new ByteArrayOutputStream();
            document.save(out);
            return out.toByteArray();
        }
    }


    private String sanitizeSvgForBatik(String svg) {
        try {
            val factory = javax.xml.parsers.DocumentBuilderFactory.newInstance();
            factory.setNamespaceAware(true);
            val builder = factory.newDocumentBuilder();
            Document document = builder.parse(new org.xml.sax.InputSource(new java.io.StringReader(svg)));
            NodeList images = document.getElementsByTagName("image");
            for (int i = images.getLength() - 1; i >= 0; i--) {
                Element image = (Element) images.item(i);
                String href = normalizeImageHref(image);
                if (href.isBlank() || !isSupportedImageHrefForBatik(href)) {
                    image.getParentNode().removeChild(image);
                    continue;
                }
                image.setAttribute("href", href);
                image.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", href);
            }
            val transformer = javax.xml.transform.TransformerFactory.newInstance().newTransformer();
            transformer.setOutputProperty(javax.xml.transform.OutputKeys.OMIT_XML_DECLARATION, "yes");
            val writer = new java.io.StringWriter();
            transformer.transform(new javax.xml.transform.dom.DOMSource(document), new javax.xml.transform.stream.StreamResult(writer));
            return writer.toString();
        } catch (Exception ignored) {
            return svg;
        }
    }

    private String normalizeImageHref(Element image) {
        String href = normalize(image.getAttribute("href"));
        if (href.isBlank()) href = normalize(image.getAttributeNS("http://www.w3.org/1999/xlink", "href"));
        return href;
    }

    private boolean isSupportedImageHrefForBatik(String href) {
        String value = href.trim().toLowerCase();
        if (value.startsWith("data:image/")) {
            int separator = value.indexOf(';');
            String mediaType = separator > 0 ? value.substring(5, separator) : value.substring(5);
            return mediaType.startsWith("image/png")
                    || mediaType.startsWith("image/jpeg")
                    || mediaType.startsWith("image/jpg")
                    || mediaType.startsWith("image/gif")
                    || mediaType.startsWith("image/svg+xml");
        }
        return value.startsWith("http://") || value.startsWith("https://") || value.startsWith("file:/");
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
                return decodeImageBytes(bytes, imageUri.substring(0, commaIndex));
            }
            HttpURLConnection connection = (HttpURLConnection) URI.create(imageUri).toURL().openConnection();
            connection.setInstanceFollowRedirects(true);
            connection.setConnectTimeout(6000);
            connection.setReadTimeout(7000);
            connection.setRequestProperty("User-Agent", "simple-mindmaps-export/1.0");
            connection.setRequestProperty("Accept", "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8");
            connection.connect();
            try (InputStream in = connection.getInputStream(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                in.transferTo(out);
                return decodeImageBytes(out.toByteArray(), connection.getContentType());
            }
        } catch (Exception ignored) {
            return null;
        }
    }

    private BufferedImage decodeImageBytes(byte[] bytes, String contentType) {
        if (bytes == null || bytes.length == 0) return null;
        String type = contentType == null ? "" : contentType.toLowerCase();
        try {
            if (type.contains("svg")) {
                return rasterizeSvg(bytes);
            }
            BufferedImage image = ImageIO.read(new ByteArrayInputStream(bytes));
            if (image != null) return image;
            if (looksLikeSvg(bytes)) return rasterizeSvg(bytes);
        } catch (Exception ignored) {
        }
        return null;
    }

    private boolean looksLikeSvg(byte[] bytes) {
        String head = new String(bytes, 0, Math.min(bytes.length, 500), StandardCharsets.UTF_8).toLowerCase();
        return head.contains("<svg");
    }

    private BufferedImage rasterizeSvg(byte[] svgBytes) {
        try {
            val transcoder = new org.apache.batik.transcoder.image.PNGTranscoder();
            val input = new org.apache.batik.transcoder.TranscoderInput(new ByteArrayInputStream(svgBytes));
            val output = new ByteArrayOutputStream();
            val out = new org.apache.batik.transcoder.TranscoderOutput(output);
            transcoder.transcode(input, out);
            return ImageIO.read(new ByteArrayInputStream(output.toByteArray()));
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


    private int resolveFontSize(NodeDto node) {
        if (node == null || node.getFontSize() <= 0) return 16;
        return Math.max(10, node.getFontSize());
    }

    private boolean hasImage(NodeDto node) {
        return node.getImageUri() != null && !node.getImageUri().isBlank();
    }


    private Color resolveTextColor(String backgroundHex) {
        Color bg = parseColor(backgroundHex);
        double luminance = (0.299 * bg.getRed() + 0.587 * bg.getGreen() + 0.114 * bg.getBlue()) / 255d;
        return luminance < 0.55 ? Color.WHITE : Color.BLACK;
    }

    private Color resolveSecondaryTextColor(String backgroundHex) {
        Color primary = resolveTextColor(backgroundHex);
        return primary.equals(Color.WHITE) ? new Color(230, 230, 230) : new Color(58, 58, 58);
    }

    private Color parseColor(String hex) {
        try {
            return Color.decode(hex);
        } catch (Exception ignored) {
            return new Color(255, 217, 102);
        }
    }
}
