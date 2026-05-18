declare module '@react-oauth/google' {
  import { ReactNode } from 'react';

  export interface TokenResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
    scope: string;
  }

  export interface UseGoogleLoginOptions {
    onSuccess: (response: TokenResponse) => void;
    onError?: (error?: { error?: string; error_description?: string }) => void;
    flow?: 'implicit' | 'auth-code';
    scope?: string;
  }

  export function GoogleOAuthProvider(props: {
    clientId: string;
    children: ReactNode;
  }): JSX.Element;

  export function useGoogleLogin(options: UseGoogleLoginOptions): () => void;
}
