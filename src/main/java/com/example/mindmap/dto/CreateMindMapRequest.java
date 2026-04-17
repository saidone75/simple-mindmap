package com.example.mindmap.dto;

import jakarta.validation.constraints.NotBlank;

public class CreateMindMapRequest {
    @NotBlank
    private String title;

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
}
