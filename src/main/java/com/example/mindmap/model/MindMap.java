package com.example.mindmap.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "mind_map")
public class MindMap {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column
    private String stylePreset;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        if (stylePreset == null || stylePreset.isBlank()) {
            stylePreset = "CLASSIC";
        }
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    public void preUpdate() {
        if (stylePreset == null || stylePreset.isBlank()) {
            stylePreset = "CLASSIC";
        }
        updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getStylePreset() { return stylePreset; }
    public void setStylePreset(String stylePreset) { this.stylePreset = stylePreset; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
