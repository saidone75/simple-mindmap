package com.example.mindmap.dto;

public class UpdateNodeRequest {
    private String text;
    private Integer x;
    private Integer y;
    private String color;
    private Integer fontSize;
    private String shape;
    private String imageUri;
    private Integer imageWidth;
    private Integer imageHeight;

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
