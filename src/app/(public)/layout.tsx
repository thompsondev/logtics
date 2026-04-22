// Public layout — no sidebar, no auth guard.
// Inherits root <html>/<body> and Providers from the root layout.
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
