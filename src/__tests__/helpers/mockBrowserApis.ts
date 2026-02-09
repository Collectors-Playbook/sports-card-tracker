export const mockFetchSuccess = (data: any, status = 200) => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    headers: new Headers(),
  } as Response);
};

export const mockFetchError = (status: number, message = 'Server error') => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: false,
    status,
    statusText: message,
    json: () => Promise.resolve({ error: message }),
    headers: new Headers(),
  } as Response);
};

export const mockFetchNetworkError = () => {
  (global.fetch as jest.Mock).mockRejectedValueOnce(
    new TypeError('Failed to fetch')
  );
};

export const seedLocalStorageUser = (userId: string) => {
  const user = { id: userId, username: 'testuser', email: 'test@example.com', role: 'user' };
  localStorage.setItem('user', JSON.stringify(user));
  localStorage.setItem('auth-state', JSON.stringify({ user }));
  localStorage.setItem('token', `local-token-${userId}-123`);
};
