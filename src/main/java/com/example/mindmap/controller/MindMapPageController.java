package com.example.mindmap.controller;

import com.example.mindmap.dto.CreateMindMapRequest;
import com.example.mindmap.service.MindMapService;
import jakarta.validation.Valid;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

@Controller
@RequestMapping("/maps")
public class MindMapPageController {

    private final MindMapService mindMapService;

    public MindMapPageController(MindMapService mindMapService) {
        this.mindMapService = mindMapService;
    }

    @GetMapping
    public String list(Model model) {
        if (!model.containsAttribute("mapForm")) {
            model.addAttribute("mapForm", new CreateMindMapRequest());
        }
        model.addAttribute("maps", mindMapService.findAll());
        return "maps/list";
    }

    @PostMapping
    public String create(@Valid @ModelAttribute("mapForm") CreateMindMapRequest mapForm,
                         BindingResult bindingResult,
                         Model model) {
        if (bindingResult.hasErrors()) {
            model.addAttribute("maps", mindMapService.findAll());
            return "maps/list";
        }
        var map = mindMapService.create(mapForm);
        return "redirect:/maps/" + map.getId();
    }

    @PostMapping("/template/{templateKey}")
    public String createTemplate(@PathVariable String templateKey) {
        var map = mindMapService.createFromTemplate(templateKey);
        return "redirect:/maps/" + map.getId();
    }

    @GetMapping("/{id}")
    public String editor(@PathVariable Long id, Model model) {
        model.addAttribute("map", mindMapService.findMapWithNodes(id));
        return "maps/editor";
    }

    @PostMapping("/{id}/delete")
    public String delete(@PathVariable Long id, RedirectAttributes redirectAttributes) {
        mindMapService.deleteMap(id);
        redirectAttributes.addFlashAttribute("message", "Mappa eliminata.");
        return "redirect:/maps";
    }
}
