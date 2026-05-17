package org.saidone.mindmaps.service;

import org.saidone.mindmaps.dto.MindMapDto;
import org.springframework.stereotype.Component;

import java.awt.image.BufferedImage;

@Component
public class MindMapExportRenderer {

    public BufferedImage renderMapImage(MindMapDto map) {
        return null;
    }


    public byte[] renderMapPdf(MindMapDto map, String format) throws Exception {
        return null;
    }

}
