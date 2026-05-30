package org.saidone.mindmaps.service;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

class MindMapExportRendererTest {

    private final MindMapExportRenderer renderer = new MindMapExportRenderer();

    @Test
    void renderSvgPngReplacesCssVariablesBeforeTranscoding() throws Exception {
        var svg = """
                <svg xmlns=\"http://www.w3.org/2000/svg\" width=\"120\" height=\"80\" viewBox=\"0 0 120 80\">
                    <rect x=\"10\" y=\"10\" width=\"100\" height=\"60\" fill=\"var(--node-color-default)\" stroke=\"var(--connector)\"/>
                    <text x=\"60\" y=\"45\" text-anchor=\"middle\" fill=\"var(--text-strong)\">Test</text>
                </svg>
                """;

        var png = renderer.renderSvgPng(svg);

        assertThat(png).startsWith(new byte[]{(byte) 0x89, 'P', 'N', 'G'});
    }

    @Test
    void replaceCssVariablesUsesCssValuesAndFallbacks() {
        var svg = "<rect fill=\"var(--node-color-default)\" stroke=\"var(--unknown, #abcdef)\" color=\"var(--card)\"/>";

        var sanitized = renderer.replaceCssVariables(svg);

        assertThat(sanitized).isEqualTo("<rect fill=\"#9FC5E8\" stroke=\"#abcdef\" color=\"#ffffff\"/>");
    }

    @Test
    void renderSvgPdfReplacesCssVariablesBeforeTranscoding() throws Exception {
        var svg = """
                <svg xmlns=\"http://www.w3.org/2000/svg\" width=\"120\" height=\"80\" viewBox=\"0 0 120 80\">
                    <rect x=\"10\" y=\"10\" width=\"100\" height=\"60\" fill=\"var(--node-color-root)\"/>
                </svg>
                """;

        var pdf = renderer.renderSvgPdf(svg, "a4");

        assertThat(new String(pdf, 0, 5, StandardCharsets.ISO_8859_1)).isEqualTo("%PDF-");
    }
}
