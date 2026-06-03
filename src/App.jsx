import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ErrorBoundary from '@/components/ErrorBoundary';
import ToastContainer from '@/components/ui/Toast';
import AppRouter from '@/routes/AppRouter';
import { useAuthListener } from '@/hooks/useAuth';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
      staleTime: 2 * 60 * 1000,
    },
    mutations: {
      retry: 1,
    },
  },
});

function AuthInitializer({ children }) {
  useAuthListener();
  return children;
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthInitializer>
          <AppRouter />
          <ToastContainer />
        </AuthInitializer>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
