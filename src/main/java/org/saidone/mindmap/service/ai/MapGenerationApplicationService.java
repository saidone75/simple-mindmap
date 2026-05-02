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
import org.saidone.mindmap.dto.MapGenerationRequestDto;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class MapGenerationApplicationService {

    private final MapGenerationService mapGenerationService;

    @Value("${app.ai.generation.max-nodes:20}")
    private int maxNodesPerRequest;

    @Value("${app.ai.generation.max-attachment-chars:60000}")
    private int maxAttachmentChars;

    @Value("${app.ai.generation.max-attempts:2}")
    private int maxAttempts;

    public MindMapDto generateMindMap(MapGenerationRequestDto request) {
        validateRequestLimits(request);

        applyReferenceTextLimit(request);
        val attempts = Math.max(1, maxAttempts);

        RuntimeException lastError = null;
        for (int i = 1; i <= attempts; i++) {
            try {
                val generated = mapGenerationService.generateMindMap(request);
                sanitize(generated);
                enforceDepth(generated, request.getMaxDepth());
                return generated;
            } catch (RuntimeException ex) {
                lastError = ex;
                log.warn("Tentativo generazione mindmap {} di {} fallito", i, attempts, ex);
            }
        }
        if (lastError != null && StringUtils.hasText(lastError.getMessage())) {
            throw new IllegalStateException(lastError.getMessage(), lastError);
        }
        throw new IllegalStateException("Impossibile generare la mindmap con l'AI al momento.", lastError);
    }

    private void validateRequestLimits(MapGenerationRequestDto request) {
        if (request == null || request.getNumberOfNodes() == null) {
            throw new IllegalStateException("Richiesta di generazione non valida.");
        }
        if (!StringUtils.hasText(request.getTopic())) {
            throw new IllegalStateException("Inserisci un argomento o una breve descrizione.");
        }
        request.setTopic(request.getTopic().trim());

        int effectiveMaxNodes = Math.max(1, maxNodesPerRequest);
        if (request.getMaxDepth() == null) {
            request.setMaxDepth(3);
        }
        request.setMaxDepth(Math.max(2, Math.min(request.getMaxDepth(), 6)));
        if (request.getNumberOfNodes() > effectiveMaxNodes) {
            throw new IllegalStateException(String.format("Numero massimo nodi superato. Limite: %d", effectiveMaxNodes));
        }
    }

    private void applyReferenceTextLimit(MapGenerationRequestDto request) {
        if (!StringUtils.hasText(request.getReferenceText())) {
            request.setReferenceText(null);
            return;
        }
        int effectiveMaxAttachmentChars = maxAttachmentChars > 0 ? maxAttachmentChars : 30000;
        String truncated = request.getReferenceText().substring(0, Math.min(effectiveMaxAttachmentChars, request.getReferenceText().length()));
        request.setReferenceText(truncated);
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


    private void enforceDepth(MindMapDto generated, Integer requestedMaxDepth) {
        int targetDepth = requestedMaxDepth == null ? 3 : requestedMaxDepth;
        targetDepth = Math.max(2, Math.min(targetDepth, 6));

        int nodeCount = generated.getNodes().size();
        if (nodeCount <= 1) {
            return;
        }

        generated.getNodes().get(0).setParentId(null);

        int effectiveDepth = Math.min(targetDepth, nodeCount - 1);
        List<List<Integer>> nodesByLevel = new ArrayList<>();
        for (int level = 0; level <= effectiveDepth; level++) {
            nodesByLevel.add(new ArrayList<>());
        }
        nodesByLevel.get(0).add(0);

        int[] depthByIndex = new int[nodeCount];

        // Guarantee at least one branch that reaches the target depth.
        int nextIndex = 1;
        int previous = 0;
        for (int level = 1; level <= effectiveDepth && nextIndex < nodeCount; level++) {
            generated.getNodes().get(nextIndex).setParentId((long) previous);
            depthByIndex[nextIndex] = level;
            nodesByLevel.get(level).add(nextIndex);
            previous = nextIndex;
            nextIndex++;
        }

        // Distribute remaining nodes level-by-level to keep a clean tree and avoid odd intersections.
        while (nextIndex < nodeCount) {
            boolean placedInThisPass = false;
            for (int level = 1; level <= effectiveDepth && nextIndex < nodeCount; level++) {
                List<Integer> parentCandidates = nodesByLevel.get(level - 1);
                if (parentCandidates.isEmpty()) {
                    continue;
                }
                int parentIdx = parentCandidates.get(nodesByLevel.get(level).size() % parentCandidates.size());
                generated.getNodes().get(nextIndex).setParentId((long) parentIdx);
                depthByIndex[nextIndex] = level;
                nodesByLevel.get(level).add(nextIndex);
                nextIndex++;
                placedInThisPass = true;
            }
            if (!placedInThisPass) {
                generated.getNodes().get(nextIndex).setParentId(0L);
                depthByIndex[nextIndex] = 1;
                nodesByLevel.get(1).add(nextIndex);
                nextIndex++;
            }
        }
    }
    private boolean hasValidNode(NodeDto node) {
        return node != null && StringUtils.hasText(node.getText());
    }

}
