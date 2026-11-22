import "./globals.css";

export const metadata = {
  title: "Download Gateway",
  description: "Multi-provider streaming download gateway",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <a href="/" className="brand">⇣ Download Gateway</a>
          <nav>
            <a href="/">Download</a>
          </nav>
        </header>
        <main className="container">{children}</main>
        <footer className="footer">Download Gateway · v0.1.0</footer>
      </body>
    </html>
  );
}
