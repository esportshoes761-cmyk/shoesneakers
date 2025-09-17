import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // 🔒 SECURE: Include user session for authentication
  const headers: Record<string, string> = data ? { "Content-Type": "application/json" } : {};
  
  // Add user session for admin authentication
  const storedUser = localStorage.getItem('zapashop_user');
  if (storedUser) {
    headers['X-User-Session'] = storedUser;
  }
  
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // 🔒 SECURE: Include user session for authentication in queries
    const headers: Record<string, string> = {};
    const storedUser = localStorage.getItem('zapashop_user');
    if (storedUser) {
      headers['X-User-Session'] = storedUser;
    }
    
    const res = await fetch(queryKey.join("/") as string, {
      headers,
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 30000, // 30 seconds instead of Infinity for real-time updates
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
