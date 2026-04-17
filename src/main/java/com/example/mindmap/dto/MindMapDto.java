package com.example.mindmap.dto;

import java.util.List;

public class MindMapDto {
    private Long id;
    private String title;
    private List<NodeDto> nodes;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public List<NodeDto> getNodes() { return nodes; }
    public void setNodes(List<NodeDto> nodes) { this.nodes = nodes; }
}
