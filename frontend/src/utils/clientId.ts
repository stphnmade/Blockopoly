const CLIENT_ID_KEY = "blockopoly_client_id";

export function getClientId(): string {
  if (typeof window === "undefined") {
    return "";
  }
  let id = window.localStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id = self.crypto?.randomUUID
      ? self.crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
    window.localStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}

