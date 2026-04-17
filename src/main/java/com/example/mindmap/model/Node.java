package com.example.mindmap.model;

import jakarta.persistence.*;

@Entity
@Table(name = "node")
public class Node {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long mapId;

    private Long parentId;

    @Column(nullable = false)
    private String text;

    @Column(nullable = false)
    private Integer x;

    @Column(nullable = false)
    private Integer y;

    @Column(nullable = false)
    private String color;

    @Column(nullable = false)
    private Integer fontSize;

    @Column(nullable = false)
    private String shape;

    @Lob
    @Column(columnDefinition = "CLOB")
    private String imageUri;

    private Integer imageWidth;

    private Integer imageHeight;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getMapId() { return mapId; }
    public void setMapId(Long mapId) { this.mapId = mapId; }
    public Long getParentId() { return parentId; }
    public void setParentId(Long parentId) { this.parentId = parentId; }
    public String getText() { return text; }
    public void setText(String text) { this.text = text; }
    public Integer getX() { return x; }
    public void setX(Integer x) { this.x = x; }
    public Integer getY() { return y; }
    public void setY(Integer y) { this.y = y; }
    public String getColor() { return color; }
    public void setColor(String color) { this.color = color; }
    public Integer getFontSize() { return fontSize; }
    public void setFontSize(Integer fontSize) { this.fontSize = fontSize; }
    public String getShape() { return shape; }
    public void setShape(String shape) { this.shape = shape; }
    public String getImageUri() { return imageUri; }
    public void setImageUri(String imageUri) { this.imageUri = imageUri; }
    public Integer getImageWidth() { return imageWidth; }
    public void setImageWidth(Integer imageWidth) { this.imageWidth = imageWidth; }
    public Integer getImageHeight() { return imageHeight; }
    public void setImageHeight(Integer imageHeight) { this.imageHeight = imageHeight; }
}
