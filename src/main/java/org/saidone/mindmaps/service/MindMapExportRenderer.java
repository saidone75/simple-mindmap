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
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Set;

@Slf4j
@Component
public class MindMapExportRenderer {

    private static final Set<String> SUPPORTED_PDF_FORMATS = Set.of("a4", "a3", "letter", "legal");

    public byte[] renderSvgPng(String svg) throws IOException, TranscoderException {
        if (!StringUtils.hasText(svg)) {
            throw new IllegalArgumentException("SVG payload is required for PNG export");
        }

        try (var output = new ByteArrayOutputStream()) {
            var transcoderInput = new TranscoderInput(new ByteArrayInputStream(svg.getBytes(StandardCharsets.UTF_8)));
            var transcoderOutput = new TranscoderOutput(output);
            var transcoder = new PNGTranscoder();
            transcoder.transcode(transcoderInput, transcoderOutput);
            return output.toByteArray();
        }
    }

    public byte[] renderSvgPdf(String svg, String format) throws Exception {
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

    public String normalizePdfFormat(String rawFormat) {
        if (!StringUtils.hasText(rawFormat)) {
            return "a4";
        }
        var normalized = rawFormat.trim().toLowerCase(Locale.ROOT);
        return SUPPORTED_PDF_FORMATS.contains(normalized) ? normalized : "a4";
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
