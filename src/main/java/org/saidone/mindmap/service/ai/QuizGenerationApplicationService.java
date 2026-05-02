/*
 * Alice's Simple Mind Map
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

package org.saidone.mindmap.service.ai;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import lombok.val;
import org.saidone.mindmap.dto.MindMapDto;
import org.saidone.mindmap.dto.NodeDto;
import org.saidone.quizmaker.dto.QuizGenerationRequestDto;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
@Slf4j
public class QuizGenerationApplicationService {

    private final MapGenerationService mapGenerationService;

    @Value("${app.ai.generation.max-questions:20}")
    private int maxQuestionsPerRequest;

    @Value("${app.ai.generation.max-attachment-chars:60000}")
    private int maxAttachmentChars;

    @Value("${app.ai.generation.max-attempts:2}")
    private int maxAttempts;

    public MindMapDto generateMindMap(QuizGenerationRequestDto request, String attachmentText) {
        validateRequestLimits(request);

        val safeAttachmentText = truncateAttachmentText(attachmentText);
        val attempts = Math.max(1, maxAttempts);

        RuntimeException lastError = null;
        for (int i = 1; i <= attempts; i++) {
            try {
                val generated = mapGenerationService.generateMindMap(request, safeAttachmentText);
                sanitize(generated);
                return generated;
            } catch (RuntimeException ex) {
                lastError = ex;
                log.warn("Tentativo generazione mindmap {} di {} fallito", i, attempts, ex);
            }
        }
        throw new IllegalStateException("Impossibile generare la mindmap con l'AI al momento.", lastError);
    }

    private void validateRequestLimits(QuizGenerationRequestDto request) {
        if (request == null || request.getNumberOfQuestions() == null) {
            throw new IllegalStateException("Richiesta di generazione non valida.");
        }

        int effectiveMaxQuestions = Math.max(1, maxQuestionsPerRequest);
        if (request.getNumberOfQuestions() > effectiveMaxQuestions) {
            throw new IllegalStateException(String.format("Numero massimo domande superato. Limite: %d", effectiveMaxQuestions));
        }
    }

    private String truncateAttachmentText(String attachmentText) {
        if (!StringUtils.hasText(attachmentText)) {
            return null;
        }
        int effectiveMaxAttachmentChars = maxAttachmentChars > 0 ? maxAttachmentChars : 30000;
        return attachmentText.substring(0, Math.min(effectiveMaxAttachmentChars, attachmentText.length()));
    }

    private void sanitize(MindMapDto generated) {
        if (generated == null || generated.getNodes() == null || generated.getNodes().isEmpty()) {
            throw new IllegalStateException("L'IA non ha generato una mindmap valida.");
        }
        if (!StringUtils.hasText(generated.getTitle())) {
            generated.setTitle("Mindmap generata dall'IA");
        }

        generated.setNodes(generated.getNodes().stream()
                .filter(this::hasValidNode)
                .toList());

        if (generated.getNodes().isEmpty()) {
            throw new IllegalStateException("L'IA non ha generato nodi utilizzabili.");
        }
    }

    private boolean hasValidNode(NodeDto node) {
        return node != null && StringUtils.hasText(node.getText());
    }

}
