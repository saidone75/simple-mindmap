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
