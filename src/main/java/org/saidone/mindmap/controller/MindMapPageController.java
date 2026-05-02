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

package org.saidone.mindmap.controller;

import org.saidone.mindmap.dto.CreateMindMapRequest;
import org.saidone.mindmap.service.MindMapService;
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
