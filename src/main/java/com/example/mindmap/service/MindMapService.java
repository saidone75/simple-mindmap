package com.example.mindmap.service;

import com.example.mindmap.dto.*;
import com.example.mindmap.model.MindMap;
import com.example.mindmap.model.Node;
import com.example.mindmap.repository.MindMapRepository;
import com.example.mindmap.repository.NodeRepository;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
public class MindMapService {
    private static final int MIN_IMAGE_SIZE = 24;
    private static final int MAX_IMAGE_SIZE = 120;
    private static final String DEFAULT_STYLE_PRESET = "CLASSIC";

    private final MindMapRepository mindMapRepository;
    private final NodeRepository nodeRepository;

    public MindMapService(MindMapRepository mindMapRepository, NodeRepository nodeRepository) {
        this.mindMapRepository = mindMapRepository;
        this.nodeRepository = nodeRepository;
    }

    public List<MindMap> findAll() {
        return mindMapRepository.findAll().stream()
                .sorted((a, b) -> b.getUpdatedAt().compareTo(a.getUpdatedAt()))
                .toList();
    }

    public MindMapDto findMapWithNodes(Long id) {
        MindMap map = getMap(id);
        MindMapDto dto = new MindMapDto();
        dto.setId(map.getId());
        dto.setTitle(map.getTitle());
        dto.setStylePreset(normalizeStylePreset(map.getStylePreset()));
        dto.setNodes(nodeRepository.findByMapIdOrderByIdAsc(id).stream().map(this::toDto).toList());
        return dto;
    }

    @Transactional
    public MindMap create(CreateMindMapRequest request) {
        MindMap map = new MindMap();
        map.setTitle(request.getTitle().trim());
        map.setStylePreset(DEFAULT_STYLE_PRESET);
        MindMap savedMap = mindMapRepository.save(map);

        Node root = new Node();
        root.setMapId(savedMap.getId());
        root.setParentId(null);
        root.setText(savedMap.getTitle());
        root.setX(620);
        root.setY(260);
        root.setColor("#FFD966");
        root.setFontSize(22);
        root.setShape("ROUNDED");
        root.setBranchColor("#7c8a9a");
        root.setBranchStyle("SOLID");
        root.setImageUri(null);
        root.setImageWidth(null);
        root.setImageHeight(null);
        nodeRepository.save(root);

        return savedMap;
    }

    @Transactional
    public MindMap createFromTemplate(String templateKey) {
        String title = switch (templateKey) {
            case "italiano" -> "Italiano";
            case "scienze" -> "Scienze";
            case "storia" -> "Storia";
            case "geografia" -> "Geografia";
            default -> "Nuova mappa";
        };
        MindMap map = new MindMap();
        map.setTitle(title);
        map.setStylePreset(DEFAULT_STYLE_PRESET);
        MindMap saved = mindMapRepository.save(map);

        Node root = createNode(saved.getId(), null, title, 620, 260, "#FFD966");

        switch (templateKey) {
            case "italiano" -> {
                createNode(saved.getId(), root.getId(), "Grammatica", 320, 120, "#9FC5E8");
                createNode(saved.getId(), root.getId(), "Lettura", 930, 120, "#B6D7A8");
                createNode(saved.getId(), root.getId(), "Scrittura", 320, 420, "#F4CCCC");
                createNode(saved.getId(), root.getId(), "Lessico", 930, 420, "#F9CB9C");
            }
            case "scienze" -> {
                createNode(saved.getId(), root.getId(), "Animali", 320, 120, "#9FC5E8");
                createNode(saved.getId(), root.getId(), "Piante", 930, 120, "#B6D7A8");
                createNode(saved.getId(), root.getId(), "Corpo umano", 320, 420, "#F4CCCC");
                createNode(saved.getId(), root.getId(), "Esperimenti", 930, 420, "#F9CB9C");
            }
            case "storia" -> {
                createNode(saved.getId(), root.getId(), "Linea del tempo", 320, 120, "#9FC5E8");
                createNode(saved.getId(), root.getId(), "Personaggi", 930, 120, "#B6D7A8");
                createNode(saved.getId(), root.getId(), "Eventi", 320, 420, "#F4CCCC");
                createNode(saved.getId(), root.getId(), "Luoghi", 930, 420, "#F9CB9C");
            }
            case "geografia" -> {
                createNode(saved.getId(), root.getId(), "Montagne", 320, 120, "#9FC5E8");
                createNode(saved.getId(), root.getId(), "Fiumi", 930, 120, "#B6D7A8");
                createNode(saved.getId(), root.getId(), "Clima", 320, 420, "#F4CCCC");
                createNode(saved.getId(), root.getId(), "Città", 930, 420, "#F9CB9C");
            }
            default -> {}
        }
        return saved;
    }

    @Transactional
    public NodeDto addNode(Long mapId, CreateNodeRequest request) {
        getMap(mapId);
        Node node = new Node();
        node.setMapId(mapId);
        node.setParentId(request.getParentId());
        node.setText(request.getText() == null || request.getText().isBlank() ? "Nuovo nodo" : request.getText().trim());
        node.setX(request.getX() == null ? 300 : request.getX());
        node.setY(request.getY() == null ? 200 : request.getY());
        node.setColor(request.getColor() == null ? "#9FC5E8" : request.getColor());
        node.setFontSize(request.getFontSize() == null ? 18 : request.getFontSize());
        node.setShape(request.getShape() == null ? "ROUNDED" : request.getShape());
        node.setBranchColor(request.getBranchColor() == null ? "#7c8a9a" : request.getBranchColor());
        node.setBranchStyle(request.getBranchStyle() == null ? "SOLID" : request.getBranchStyle());
        node.setImageUri(normalizeImageUri(request.getImageUri()));
        node.setImageWidth(normalizeImageSize(request.getImageWidth()));
        node.setImageHeight(normalizeImageSize(request.getImageHeight()));
        return toDto(nodeRepository.save(node));
    }

    @Transactional
    public NodeDto updateNode(Long nodeId, UpdateNodeRequest request) {
        Node node = nodeRepository.findById(nodeId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Nodo non trovato"));

        if (request.getText() != null) node.setText(request.getText().trim().isEmpty() ? "Nodo" : request.getText().trim());
        if (request.getX() != null) node.setX(request.getX());
        if (request.getY() != null) node.setY(request.getY());
        if (request.getColor() != null) node.setColor(request.getColor());
        if (request.getFontSize() != null) node.setFontSize(request.getFontSize());
        if (request.getShape() != null) node.setShape(request.getShape());
        if (request.getBranchColor() != null) node.setBranchColor(request.getBranchColor());
        if (request.getBranchStyle() != null) node.setBranchStyle(request.getBranchStyle());
        if (request.getImageUri() != null) node.setImageUri(normalizeImageUri(request.getImageUri()));
        if (request.getImageWidth() != null) node.setImageWidth(normalizeImageSize(request.getImageWidth()));
        if (request.getImageHeight() != null) node.setImageHeight(normalizeImageSize(request.getImageHeight()));

        return toDto(nodeRepository.save(node));
    }

    @Transactional
    public void deleteNode(Long nodeId) {
        List<Node> allNodes = nodeRepository.findAll();
        deleteRecursive(nodeId, allNodes);
    }

    @Transactional
    public void deleteMap(Long id) {
        getMap(id);
        nodeRepository.deleteByMapId(id);
        mindMapRepository.deleteById(id);
    }

    @Transactional
    public MindMapDto updateMapStyle(Long mapId, String stylePreset) {
        MindMap map = getMap(mapId);
        map.setStylePreset(normalizeStylePreset(stylePreset));
        mindMapRepository.save(map);
        return findMapWithNodes(mapId);
    }

    private void deleteRecursive(Long nodeId, List<Node> allNodes) {
        for (Node child : allNodes.stream().filter(n -> nodeId.equals(n.getParentId())).toList()) {
            deleteRecursive(child.getId(), allNodes);
        }
        nodeRepository.deleteById(nodeId);
    }

    private Node createNode(Long mapId, Long parentId, String text, int x, int y, String color) {
        Node node = new Node();
        node.setMapId(mapId);
        node.setParentId(parentId);
        node.setText(text);
        node.setX(x);
        node.setY(y);
        node.setColor(color);
        node.setFontSize(parentId == null ? 22 : 18);
        node.setShape("ROUNDED");
        node.setBranchColor("#7c8a9a");
        node.setBranchStyle("SOLID");
        node.setImageUri(null);
        node.setImageWidth(null);
        node.setImageHeight(null);
        return nodeRepository.save(node);
    }

    private MindMap getMap(Long id) {
        return mindMapRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Mappa non trovata"));
    }


    private String normalizeImageUri(String imageUri) {
        if (imageUri == null) return null;
        String value = imageUri.trim();
        return value.isEmpty() ? null : value;
    }

    private Integer normalizeImageSize(Integer imageSize) {
        if (imageSize == null) return null;
        return Math.min(MAX_IMAGE_SIZE, Math.max(MIN_IMAGE_SIZE, imageSize));
    }

    private String normalizeStylePreset(String stylePreset) {
        if (stylePreset == null || stylePreset.isBlank()) return DEFAULT_STYLE_PRESET;
        return switch (stylePreset.trim().toUpperCase()) {
            case "PLAYFUL", "OCEAN", "CANDY", "CLASSIC" -> stylePreset.trim().toUpperCase();
            default -> DEFAULT_STYLE_PRESET;
        };
    }

    private NodeDto toDto(Node node) {
        NodeDto dto = new NodeDto();
        dto.setId(node.getId());
        dto.setParentId(node.getParentId());
        dto.setText(node.getText());
        dto.setX(node.getX());
        dto.setY(node.getY());
        dto.setColor(node.getColor());
        dto.setFontSize(node.getFontSize());
        dto.setShape(node.getShape());
        dto.setBranchColor(node.getBranchColor());
        dto.setBranchStyle(node.getBranchStyle());
        dto.setImageUri(node.getImageUri());
        dto.setImageWidth(node.getImageWidth());
        dto.setImageHeight(node.getImageHeight());
        return dto;
    }
}
