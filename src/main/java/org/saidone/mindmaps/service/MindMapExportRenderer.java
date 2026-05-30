package org.saidone.mindmaps.service;

import lombok.extern.slf4j.Slf4j;
import org.apache.batik.transcoder.TranscoderException;
import org.apache.batik.transcoder.TranscoderInput;
import org.apache.batik.transcoder.TranscoderOutput;
import org.apache.batik.transcoder.image.PNGTranscoder;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.graphics.image.LosslessFactory;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

@Slf4j
@Component
public class MindMapExportRenderer {

    private static final String APP_CSS_RESOURCE = "static/css/app.css";
    private static final Set<String> SUPPORTED_PDF_FORMATS = Set.of("a4", "a3", "letter", "legal");
    private static final Pattern CSS_VARIABLE_PATTERN = Pattern.compile("var\\(\\s*--([A-Za-z0-9_-]+)(?:\\s*,\\s*([^)]*))?\\s*\\)");
    private static final Pattern CSS_VARIABLE_DECLARATION_PATTERN = Pattern.compile("--([A-Za-z0-9_-]+)\\s*:\\s*([^;]+);");

    private final Map<String, String> exportCssVariables;

    public MindMapExportRenderer() {
        this.exportCssVariables = loadCssVariables();
    }

    public byte[] renderSvgPng(String svg) throws TranscoderException, IOException {
        if (!StringUtils.hasText(svg)) {
            throw new IllegalArgumentException("SVG payload is required for PNG export");
        }

        var exportSafeSvg = replaceCssVariables(svg);

        try (var output = new ByteArrayOutputStream()) {
            var transcoderInput = new TranscoderInput(new ByteArrayInputStream(exportSafeSvg.getBytes(StandardCharsets.UTF_8)));
            var transcoderOutput = new TranscoderOutput(output);
            var transcoder = new PNGTranscoder();
            transcoder.transcode(transcoderInput, transcoderOutput);
            return output.toByteArray();
        }
    }

    public byte[] renderSvgPdf(String svg, String format) throws TranscoderException, IOException {
        var pngBytes = renderSvgPng(svg);
        var image = ImageIO.read(new ByteArrayInputStream(pngBytes));
        if (image == null) {
            throw new IllegalStateException("Unable to decode generated PNG for PDF export");
        }

        var pageSize = resolvePageSize(normalizePdfFormat(format));

        try (var document = new PDDocument(); var pdfOutput = new ByteArrayOutputStream()) {
            var page = new PDPage(pageSize);
            document.addPage(page);

            var pdImage = LosslessFactory.createFromImage(document, image);
            drawCenteredImage(document, page, pdImage, image);

            document.save(pdfOutput);
            return pdfOutput.toByteArray();
        }
    }

    String replaceCssVariables(String svg) {
        return replaceCssVariables(svg, exportCssVariables, 0);
    }

    private static String replaceCssVariables(String value, Map<String, String> cssVariables, int depth) {
        if (!StringUtils.hasText(value) || depth > 10) {
            return value;
        }

        var matcher = CSS_VARIABLE_PATTERN.matcher(value);
        var result = new StringBuilder();
        while (matcher.find()) {
            var variableName = matcher.group(1);
            var fallback = matcher.group(2);
            var replacement = cssVariables.get(variableName);
            if (!StringUtils.hasText(replacement)) {
                replacement = StringUtils.hasText(fallback) ? fallback.trim() : "#000000";
            }
            matcher.appendReplacement(result, java.util.regex.Matcher.quoteReplacement(replacement));
        }
        matcher.appendTail(result);

        var replaced = result.toString();
        return CSS_VARIABLE_PATTERN.matcher(replaced).find()
                ? replaceCssVariables(replaced, cssVariables, depth + 1)
                : replaced;
    }

    public String normalizePdfFormat(String rawFormat) {
        if (!StringUtils.hasText(rawFormat)) {
            return "a4";
        }
        var normalized = rawFormat.trim().toLowerCase(Locale.ROOT);
        return SUPPORTED_PDF_FORMATS.contains(normalized) ? normalized : "a4";
    }

    private Map<String, String> loadCssVariables() {
        try {
            var css = new ClassPathResource(APP_CSS_RESOURCE).getContentAsString(StandardCharsets.UTF_8);
            return resolveCssVariableDeclarations(css);
        } catch (IOException exception) {
            log.warn("Unable to load CSS variables for SVG export from {}", APP_CSS_RESOURCE, exception);
            return Map.of();
        }
    }

    private static Map<String, String> resolveCssVariableDeclarations(String css) {
        var rawVariables = new HashMap<String, String>();
        var matcher = CSS_VARIABLE_DECLARATION_PATTERN.matcher(css);
        while (matcher.find()) {
            rawVariables.put(matcher.group(1), matcher.group(2).trim());
        }

        var resolvedVariables = new HashMap<String, String>();
        for (var entry : rawVariables.entrySet()) {
            resolvedVariables.put(entry.getKey(), replaceCssVariables(entry.getValue(), rawVariables, 0));
        }
        return Map.copyOf(resolvedVariables);
    }

    private PDRectangle resolvePageSize(String format) {
        return switch (format) {
            case "a3" -> PDRectangle.A3;
            case "letter" -> PDRectangle.LETTER;
            case "legal" -> PDRectangle.LEGAL;
            default -> PDRectangle.A4;
        };
    }

    private void drawCenteredImage(PDDocument document, PDPage page, PDImageXObject pdImage, BufferedImage image) throws IOException {
        var pageWidth = page.getMediaBox().getWidth();
        var pageHeight = page.getMediaBox().getHeight();

        var imageWidth = (float) image.getWidth();
        var imageHeight = (float) image.getHeight();

        var scale = Math.min(pageWidth / imageWidth, pageHeight / imageHeight);
        var drawWidth = imageWidth * scale;
        var drawHeight = imageHeight * scale;

        var offsetX = (pageWidth - drawWidth) / 2;
        var offsetY = (pageHeight - drawHeight) / 2;

        try (var content = new PDPageContentStream(document, page)) {
            content.drawImage(pdImage, offsetX, offsetY, drawWidth, drawHeight);
        }
    }

}
