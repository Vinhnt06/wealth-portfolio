import apiClient from './client';

export interface LoginRequest {
    email: string;
    password: string;
}

export interface RegisterRequest {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
}

export interface AuthResponse {
    token: string;
    type: string;
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
}

export const authApi = {
    /**
     * Login user
     */
    login: async (data: LoginRequest): Promise<AuthResponse> => {
        const response = await apiClient.post<AuthResponse>('/auth/login', data);

        // Store token and user info
        localStorage.setItem('jwt_token', response.data.token);
        localStorage.setItem('user', JSON.stringify({
            userId: response.data.userId,
            email: response.data.email,
            firstName: response.data.firstName,
            lastName: response.data.lastName,
        }));

        return response.data;
    },

    /**
     * Register new user
     */
    register: async (data: RegisterRequest): Promise<AuthResponse> => {
        const response = await apiClient.post<AuthResponse>('/auth/register', data);

        // Store token and user info
        localStorage.setItem('jwt_token', response.data.token);
        localStorage.setItem('user', JSON.stringify({
            userId: response.data.userId,
            email: response.data.email,
            firstName: response.data.firstName,
            lastName: response.data.lastName,
        }));

        return response.data;
    },

    /**
     * Logout user
     */
    logout: () => {
        localStorage.removeItem('jwt_token');
        localStorage.removeItem('user');
        window.location.href = '/login';
    },

    /**
     * Get current user from localStorage
     */
    getCurrentUser: () => {
        const userStr = localStorage.getItem('user');
        return userStr ? JSON.parse(userStr) : null;
    },

    /**
     * Check if user is authenticated
     */
    isAuthenticated: () => {
        return !!localStorage.getItem('jwt_token');
    },
};
