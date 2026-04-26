import apiClient from './client';

export interface Asset {
    id: string;
    type: string;
    symbol: string;
    name: string;
    quantity: number;
    avgBuyPrice: number;
    createdAt: string;
    updatedAt: string;
}

export interface CreateAssetRequest {
    type: string;
    symbol: string;
    name: string;
    quantity: number;
    avgBuyPrice: number;
}

export interface UpdateAssetRequest {
    quantity?: number;
    avgBuyPrice?: number;
    name?: string;
}

export interface PortfolioSummary {
    totalValue: number;
    totalCost: number;
    totalProfitLoss: number;
    totalProfitLossPercent: number;
    assetCount: number;
    assets: Array<{
        id: string;
        symbol: string;
        name: string;
        type: string;
        quantity: number;
        avgBuyPrice: number;
        currentPrice: number;
        currentValue: number;
        profitLoss: number;
        profitLossPercent: number;
    }>;
}

export const assetsApi = {
    /**
     * Get all user assets
     */
    getAll: async (): Promise<Asset[]> => {
        const response = await apiClient.get<Asset[]>('/assets');
        return response.data;
    },

    /**
     * Get portfolio summary with P/L
     */
    getPortfolio: async (): Promise<PortfolioSummary> => {
        const response = await apiClient.get<PortfolioSummary>('/assets/portfolio');
        return response.data;
    },

    /**
     * Get single asset
     */
    getById: async (id: string): Promise<Asset> => {
        const response = await apiClient.get<Asset>(`/assets/${id}`);
        return response.data;
    },

    /**
     * Create new asset
     */
    create: async (data: CreateAssetRequest): Promise<Asset> => {
        const response = await apiClient.post<Asset>('/assets', data);
        return response.data;
    },

    /**
     * Update asset
     */
    update: async (id: string, data: UpdateAssetRequest): Promise<Asset> => {
        const response = await apiClient.put<Asset>(`/assets/${id}`, data);
        return response.data;
    },

    /**
     * Delete asset
     */
    delete: async (id: string): Promise<void> => {
        await apiClient.delete(`/assets/${id}`);
    },
};
