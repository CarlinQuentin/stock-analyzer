import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";
const TOKEN_KEY = "stock_analyzer_jwt_token";

export interface UserProfile {
  id: number;
  name: string;
  email: string;
  created_at?: string;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: UserProfile;
}

class AuthService {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  }

  removeToken(): void {
    localStorage.removeItem(TOKEN_KEY);
  }

  private getAuthHeader() {
    const token = this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async register(name: string, email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await axios.post<AuthResponse>(`${API_BASE_URL}/auth/register`, {
        name,
        email,
        password,
      });

      if (response.data.token) {
        this.setToken(response.data.token);
      }
      return response.data;
    } catch (error: any) {
      const msg = error.response?.data?.message || "Registration failed. Please try again.";
      throw new Error(msg);
    }
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await axios.post<AuthResponse>(`${API_BASE_URL}/auth/login`, {
        email,
        password,
      });

      if (response.data.token) {
        this.setToken(response.data.token);
      }
      return response.data;
    } catch (error: any) {
      const msg = error.response?.data?.message || "Invalid email or password";
      throw new Error(msg);
    }
  }

  async getMe(): Promise<UserProfile | null> {
    const token = this.getToken();
    if (!token) return null;

    try {
      const response = await axios.get<{ user: UserProfile }>(`${API_BASE_URL}/auth/me`, {
        headers: this.getAuthHeader(),
      });
      return response.data.user;
    } catch (error) {
      this.removeToken();
      return null;
    }
  }

  logout(): void {
    this.removeToken();
  }
}

export const authService = new AuthService();
