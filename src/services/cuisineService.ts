import { apiRequest } from "./client";
import { CuisineType } from "./types";

export const cuisineService = {
  getCuisineTypes: async (): Promise<CuisineType[]> => {
    return apiRequest<CuisineType[]>("food/cuisine-types");
  },
};
