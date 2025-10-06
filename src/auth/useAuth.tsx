import { useMsal } from '@azure/msal-react';
import { loginRequest } from './msalConfig';

export function useAuth() {
  const { instance, accounts } = useMsal();
  
  const login = async () => {
    try {
      await instance.loginRedirect(loginRequest);
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await instance.logoutRedirect({
        account: accounts[0],
      });
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    }
  };

  return {
    isAuthenticated: accounts.length > 0,
    account: accounts[0] || null,
    login,
    logout,
  };
}
