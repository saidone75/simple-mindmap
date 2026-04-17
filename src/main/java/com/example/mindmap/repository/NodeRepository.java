package com.example.mindmap.repository;

import com.example.mindmap.model.Node;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface NodeRepository extends JpaRepository<Node, Long> {
    List<Node> findByMapIdOrderByIdAsc(Long mapId);
    void deleteByMapId(Long mapId);
}
