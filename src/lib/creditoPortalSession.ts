// Sesión del portal de crédito (candado con contraseña). El backend valida y expira la sesión.
const key = (token: string) => `credito_portal_session_${token}`;

export const getPortalSession = (token?: string) => (token ? localStorage.getItem(key(token)) : null);
export const setPortalSession = (token: string, s: string) => localStorage.setItem(key(token), s);
export const clearPortalSession = (token: string) => localStorage.removeItem(key(token));
