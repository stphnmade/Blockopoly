type RuntimeBlockopolyConfig = {
  roomService?: string;
  gameService?: string;
};

declare global {
  interface Window {
    BLOCKOPOLY_CONFIG?: RuntimeBlockopolyConfig;
  }
}

const PUBLIC_SERVER = "https://playblockopoly.com";

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const isLocalHost = () => {
  if (typeof window === "undefined") return false;
  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
};

const sameOriginService = (publicPath: string) => {
  if (typeof window === "undefined") return undefined;
  if (!/^https?:$/.test(window.location.protocol)) return undefined;
  if (isLocalHost()) return undefined;
  return `${window.location.origin}${publicPath}`;
};

const fromStorage = (key: string) => {
  if (typeof window === "undefined") return undefined;

  try {
    return window.localStorage.getItem(key) || undefined;
  } catch {
    return undefined;
  }
};

const runtimeConfig = () =>
  typeof window === "undefined" ? undefined : window.BLOCKOPOLY_CONFIG;

const resolveServiceUrl = (
  runtimeValue: string | undefined,
  storageKey: string,
  viteValue: string | undefined,
  publicPath: string,
  localFallback: string
) => {
  const configured =
    runtimeValue ||
    fromStorage(storageKey) ||
    viteValue ||
    sameOriginService(publicPath) ||
    (typeof window !== "undefined" && window.location.protocol === "file:"
      ? `${PUBLIC_SERVER}${publicPath}`
      : undefined) ||
    localFallback;

  return trimTrailingSlash(configured);
};

export const ROOM_SERVICE_URL = resolveServiceUrl(
  runtimeConfig()?.roomService,
  "BLOCKOPOLY_ROOM_SERVICE",
  import.meta.env.VITE_ROOM_SERVICE || import.meta.env.VITE_API_BASE,
  "/api/room",
  "http://localhost:8080"
);

export const GAME_SERVICE_URL = resolveServiceUrl(
  runtimeConfig()?.gameService,
  "BLOCKOPOLY_GAME_SERVICE",
  import.meta.env.VITE_GAME_SERVICE,
  "/api/game",
  "http://localhost:8081"
);

export const toWebSocketUrl = (base: string) =>
  base
    .replace(/^http(s?):\/\//, (_: string, secure: string) =>
      secure ? "wss://" : "ws://"
    )
    .replace(/\/+$/, "");
