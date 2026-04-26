package com.yourfin.api.service;

import com.yourfin.api.model.user.User;
import com.yourfin.api.repository.user.UserRepository;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class UserService {

    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    /**
     * Get currently authenticated user
     */
    public User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new RuntimeException("No authenticated user");
        }

        User user = (User) authentication.getPrincipal();
        return userRepository.findById(user.getId())
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    /**
     * Get user by ID
     */
    public User getUserById(UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    /**
     * Update user profile
     */
    @Transactional
    public User updateProfile(UUID userId, User updates) {
        User user = getUserById(userId);

        // Update allowed fields
        if (updates.getFirstName() != null) {
            user.setFirstName(updates.getFirstName());
        }
        if (updates.getLastName() != null) {
            user.setLastName(updates.getLastName());
        }
        if (updates.getPhone() != null) {
            user.setPhone(updates.getPhone());
        }
        if (updates.getBio() != null) {
            user.setBio(updates.getBio());
        }
        if (updates.getLocation() != null) {
            user.setLocation(updates.getLocation());
        }
        if (updates.getDateOfBirth() != null) {
            user.setDateOfBirth(updates.getDateOfBirth());
        }
        if (updates.getOccupation() != null) {
            user.setOccupation(updates.getOccupation());
        }

        return userRepository.save(user);
    }

    /**
     * Delete user account
     */
    @Transactional
    public void deleteAccount(UUID userId) {
        User user = getUserById(userId);
        userRepository.delete(user);
    }
}
