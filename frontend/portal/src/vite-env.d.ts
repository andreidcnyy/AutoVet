/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID: string;
}

interface GoogleTokenClientConfig {
  client_id: string;
  scope: string;
  callback: (response: { access_token?: string; error?: string }) => void;
}

interface GoogleTokenClient {
  requestAccessToken(): void;
}

interface Window {
  google?: {
    accounts: {
      oauth2: {
        initTokenClient(config: GoogleTokenClientConfig): GoogleTokenClient;
      };
    };
  };
}

