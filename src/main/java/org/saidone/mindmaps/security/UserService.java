/*
 * Alice's Simple Mind Maps
 * Copyright (C) 2026 Miss Alice & Saidone
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

package org.saidone.mindmaps.security;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.val;
import org.saidone.mindmaps.model.AppUser;
import org.saidone.mindmaps.repository.AppUserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class UserService {

    private final AppUserRepository appUserRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional
    public AppUser createUser(String username, String rawPassword) {
        val normalizedUsername = normalizeUsername(username);
        validatePassword(rawPassword);
        if (appUserRepository.existsByUsernameIgnoreCase(normalizedUsername)) {
            throw new IllegalArgumentException("Username già esistente");
        }

        val user = new AppUser();
        user.setUsername(normalizedUsername);
        user.setPassword(passwordEncoder.encode(rawPassword));
        user.setEnabled(true);
        return appUserRepository.save(user);
    }

    private String normalizeUsername(String username) {
        if (username == null || username.isBlank()) {
            throw new IllegalArgumentException("Username obbligatorio");
        }
        val normalized = username.trim().toLowerCase();
        if (normalized.length() < 3 || normalized.length() > 80) {
            throw new IllegalArgumentException("Lo username deve contenere tra 3 e 80 caratteri");
        }
        if (!normalized.matches("[a-z0-9._@-]+")) {
            throw new IllegalArgumentException("Lo username contiene caratteri non validi");
        }
        return normalized;
    }

    private void validatePassword(String rawPassword) {
        if (rawPassword == null || rawPassword.length() < 8) {
            throw new IllegalArgumentException("La password deve contenere almeno 8 caratteri");
        }
    }
}
