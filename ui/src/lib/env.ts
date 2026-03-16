const isDev = import.meta.env.DEV;

function getRequiredEnv(name: string): string {
  const value = import.meta.env[name];

  if (isDev && (!value || value.trim() === "")) {
    throw new Error(
      `Missing required environment variable: ${name}\n\n` +
        `Please add it to your .env file or set it in your environment.` +
        `${name}=your_value_here`,
    );
  }

  return value;
}

export const API_URL = getRequiredEnv("VITE_API_URL");
export const PROGRAM_ID = getRequiredEnv("VITE_PROGRAM_ID");
