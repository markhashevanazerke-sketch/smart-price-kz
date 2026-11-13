import { AppProvider } from '@/lib/app-context';

export default function LunarECLayout({ children }: { children: React.ReactNode }) {
  return <AppProvider>{children}</AppProvider>;
}
