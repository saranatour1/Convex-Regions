// Browser-side identity. Both are random secrets; the server stores only their SHA-256.
// userKey = this browser (localStorage). sessionToken = this tab (sessionStorage).
const randomToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
};

const persisted = (store: () => Storage, key: string) => {
  try {
    const value = store().getItem(key) ?? randomToken();
    store().setItem(key, value);
    return value;
  } catch {
    return randomToken(); // storage blocked: fresh identity per page load
  }
};

export const userKey = persisted(() => localStorage, "userKey");
export const sessionToken = persisted(() => sessionStorage, "sessionToken");
