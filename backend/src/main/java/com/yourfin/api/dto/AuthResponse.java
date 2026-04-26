package com.yourfin.api.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.UUID;

@Data
@AllArgsConstructor
public class AuthResponse {
    private String token;
    private String type = "Bearer";
    private UUID userId;
    private String email;
    private String firstName;
    private String lastName;

    public AuthResponse(String token, UUID userId, String email, String firstName, String lastName) {
        this.token = token;
        this.userId = userId;
        this.email = email;
        this.firstName = firstName;
        this.lastName = lastName;
    }
}
