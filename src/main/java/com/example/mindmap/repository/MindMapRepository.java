package com.example.mindmap.repository;

import com.example.mindmap.model.MindMap;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MindMapRepository extends JpaRepository<MindMap, Long> {
}
