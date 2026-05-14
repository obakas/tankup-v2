const ADMIN_TOKEN_KEY = "admin_access_token";

export function saveAdminToken(token: string) {
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function getAdminToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

export function clearAdminToken() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
}

export function isAdminLoggedIn() {
  return !!getAdminToken();
}