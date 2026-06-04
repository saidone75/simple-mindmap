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

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import lombok.val;
import org.saidone.mindmaps.repository.AppUserRepository;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@EnableConfigurationProperties(InitialUserProperties.class)
@Slf4j
public class InitialUserRunner implements ApplicationRunner {

    private final InitialUserProperties initialUserProperties;
    private final UserService userService;
    private final AppUserRepository appUserRepository;

    @Override
    public void run(ApplicationArguments args) {
        if (!initialUserProperties.configured()) {
            return;
        }
        val username = initialUserProperties.username().trim().toLowerCase();
        if (appUserRepository.existsByUsernameIgnoreCase(username)) {
            log.info("Utente iniziale '{}' già presente: creazione saltata", username);
            return;
        }
        userService.createUser(username, initialUserProperties.password());
        log.info("Utente iniziale '{}' creato", username);
    }
}
