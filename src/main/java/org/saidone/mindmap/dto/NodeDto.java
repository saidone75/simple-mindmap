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

package org.saidone.mindmap.dto;

public class NodeDto {
    private Long id;
    private Long parentId;
    private String text;
    private String emoji;
    private String branchText;
    private Integer x;
    private Integer y;
    private String color;
    private Integer fontSize;
    private String shape;
    private String branchColor;
    private String branchStyle;
    private String imageUri;
    private Integer imageWidth;
    private Integer imageHeight;
    private Integer nodeWidth;
    private Integer nodeHeight;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getParentId() { return parentId; }
    public void setParentId(Long parentId) { this.parentId = parentId; }
    public String getText() { return text; }
    public void setText(String text) { this.text = text; }
    public String getEmoji() { return emoji; }
    public void setEmoji(String emoji) { this.emoji = emoji; }
    public String getBranchText() { return branchText; }
    public void setBranchText(String branchText) { this.branchText = branchText; }
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
    public String getBranchColor() { return branchColor; }
    public void setBranchColor(String branchColor) { this.branchColor = branchColor; }
    public String getBranchStyle() { return branchStyle; }
    public void setBranchStyle(String branchStyle) { this.branchStyle = branchStyle; }
    public String getImageUri() { return imageUri; }
    public void setImageUri(String imageUri) { this.imageUri = imageUri; }
    public Integer getImageWidth() { return imageWidth; }
    public void setImageWidth(Integer imageWidth) { this.imageWidth = imageWidth; }
    public Integer getImageHeight() { return imageHeight; }
    public void setImageHeight(Integer imageHeight) { this.imageHeight = imageHeight; }
    public Integer getNodeWidth() { return nodeWidth; }
    public void setNodeWidth(Integer nodeWidth) { this.nodeWidth = nodeWidth; }
    public Integer getNodeHeight() { return nodeHeight; }
    public void setNodeHeight(Integer nodeHeight) { this.nodeHeight = nodeHeight; }
}
