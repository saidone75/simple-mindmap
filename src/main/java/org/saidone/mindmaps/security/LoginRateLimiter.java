/*
 * Alice's Simple Mind Maps
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

package org.saidone.mindmaps.security;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicInteger;

@Service
public class LoginRateLimiter {

    private static final int MAX_FAILED_ATTEMPTS = 5;
    private static final Duration FAILURE_WINDOW = Duration.ofMinutes(15);

    private final Cache<String, AtomicInteger> attempts = Caffeine.newBuilder()
            .expireAfterWrite(FAILURE_WINDOW)
            .maximumSize(10_000)
            .build();

    public boolean isBlocked(String username, String remoteAddress) {
        var counter = attempts.getIfPresent(key(username, remoteAddress));
        return counter != null && counter.get() >= MAX_FAILED_ATTEMPTS;
    }

    public void recordFailure(String username, String remoteAddress) {
        attempts.get(key(username, remoteAddress), ignored -> new AtomicInteger()).incrementAndGet();
    }

    public void recordSuccess(String username, String remoteAddress) {
        attempts.invalidate(key(username, remoteAddress));
    }

    private String key(String username, String remoteAddress) {
        var normalizedUsername = username == null ? "" : username.trim().toLowerCase(Locale.ROOT);
        var normalizedRemoteAddress = remoteAddress == null ? "unknown" : remoteAddress.trim();
        return normalizedRemoteAddress + ":" + normalizedUsername;
    }
}
