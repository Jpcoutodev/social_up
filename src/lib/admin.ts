export const ADMIN_EMAIL = 'coutodev7@gmail.com';

export const isAdmin = (email?: string | null): boolean => {
  return (email || '').trim().toLowerCase() === ADMIN_EMAIL;
};
