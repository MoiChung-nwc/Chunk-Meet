import axiosInstance from "./axiosInstance";

export const login = (data) => axiosInstance.post("/auth/login", data);
export const register = (data) => axiosInstance.post("/auth/register", data);
export const refresh = (data) => axiosInstance.post("/auth/refresh-token", data);
export const logout = (data) => axiosInstance.post("/auth/logout", data);
