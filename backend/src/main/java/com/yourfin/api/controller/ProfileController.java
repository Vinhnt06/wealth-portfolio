package com.yourfin.api.controller;

import com.yourfin.api.model.user.User;
import com.yourfin.api.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/profile")
public class ProfileController {

    private final UserService userService;

    public ProfileController(UserService userService) {
        this.userService = userService;
    }

    /**
     * Get current user profile
     */
    @GetMapping
    public ResponseEntity<User> getProfile() {
        User user = userService.getCurrentUser();
        return ResponseEntity.ok(user);
    }

    /**
     * Update current user profile
     */
    @PutMapping
    public ResponseEntity<User> updateProfile(@RequestBody User updates) {
        User currentUser = userService.getCurrentUser();
        User updated = userService.updateProfile(currentUser.getId(), updates);
        return ResponseEntity.ok(updated);
    }

    /**
     * Delete current user account
     */
    @DeleteMapping
    public ResponseEntity<Void> deleteAccount() {
        User currentUser = userService.getCurrentUser();
        userService.deleteAccount(currentUser.getId());
        return ResponseEntity.noContent().build();
    }
}
