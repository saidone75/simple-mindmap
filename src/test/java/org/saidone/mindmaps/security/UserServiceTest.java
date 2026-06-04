package org.saidone.mindmaps.security;

import org.junit.jupiter.api.Test;
import org.saidone.mindmaps.repository.AppUserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;

@DataJpaTest
@Import({UserService.class, UserServiceTest.PasswordEncoderTestConfig.class})
class UserServiceTest {

    @Autowired
    private UserService userService;

    @Autowired
    private AppUserRepository appUserRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Test
    void createUserPersistsNormalizedLoginAndEncodedPassword() {
        var user = userService.createUser(" Alice@example.COM ", "password-segreta");

        assertThat(user.getId()).isNotNull();
        assertThat(user.getUsername()).isEqualTo("alice@example.com");
        assertThat(user.getPassword()).isNotEqualTo("password-segreta");
        assertThat(passwordEncoder.matches("password-segreta", user.getPassword())).isTrue();
        assertThat(user.isEnabled()).isTrue();
        assertThat(appUserRepository.findByUsernameIgnoreCase("ALICE@example.com")).contains(user);
    }

    @Test
    void createUserRejectsDuplicateLoginIgnoringCase() {
        userService.createUser("alice", "password-segreta");

        assertThatIllegalArgumentException()
                .isThrownBy(() -> userService.createUser("ALICE", "altra-password"))
                .withMessage("Username già esistente");
    }

    @TestConfiguration
    static class PasswordEncoderTestConfig {
        @Bean
        PasswordEncoder passwordEncoder() {
            return new BCryptPasswordEncoder();
        }
    }
}
