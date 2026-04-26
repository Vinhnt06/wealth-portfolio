import apiClient from './client';

export interface User {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
    bio?: string;
    location?: string;
    dateOfBirth?: string;
    occupation?: string;
}

export interface UpdateProfileRequest {
    firstName?: string;
    lastName?: string;
    phone?: string;
    bio?: string;
    location?: string;
    dateOfBirth?: string;
    occupation?: string;
}

export const profileApi = {
    /**
     * Get current user profile
     */
    get: async (): Promise<User> => {
        const response = await apiClient.get<User>('/profile');
        return response.data;
    },

    /**
     * Update profile
     */
    update: async (data: UpdateProfileRequest): Promise<User> => {
        const response = await apiClient.put<User>('/profile', data);
        return response.data;
    },

    /**
     * Delete account
     */
    delete: async (): Promise<void> => {
        await apiClient.delete('/profile');
    },
};
