import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.rafaygen.aiagent",
  appName: "RafayGen AI Agent",
  webDir: "dist",
  server: {
    androidScheme: "https"
  }
};

export default config;
