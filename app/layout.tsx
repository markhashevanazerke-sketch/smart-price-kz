import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'sonner';

export const metadata: Metadata = {
  title: 'SMART PRICE — Intelligent Food Price Monitoring System',
  description: 'Платформа мониторинга, анализа и сравнения цен на социально значимые продукты питания в Казахстане. Хакатон 2026, кейс №3. Построено на архитектуре LunarEC.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className="h-full">
      <body className="h-full font-sans bg-[#F4F6FA] text-slate-900 antialiased">
        {children}
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  );
}
