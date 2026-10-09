/** La cabecera de Wali: el logo (la burbuja aprobada el 8-oct) y el botón para entrar al CRM. */
export function CabeceraWali() {
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 50, background: "#09090e", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
      <nav style={{ maxWidth: 1200, margin: "0 auto", height: 64, padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <a href="/precios" aria-label="Wali" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
          <svg viewBox="0 0 100 100" width="36" height="36" aria-hidden="true">
            <mask id="wali-cab"><rect width="100" height="100" fill="#fff" /><circle cx="79" cy="17" r="9.2" fill="#000" /></mask>
            <path mask="url(#wali-cab)" d="M31 10h38a18 18 0 0 1 18 18v30a18 18 0 0 1-18 18H45L31.5 90.2Q26 96 26 88V75.1A18 18 0 0 1 13 58V28A18 18 0 0 1 31 10z" fill="#FFD21F" />
            <text x="50" y="60.5" textAnchor="middle" fontFamily="var(--font-bricolage), sans-serif" fontWeight="800" fontSize="57" letterSpacing="-2" fill="#17140F">w</text>
            <circle cx="79" cy="17" r="6.5" fill="#FF4D1A" />
          </svg>
          <span style={{ fontFamily: "var(--font-bricolage), sans-serif", fontWeight: 800, fontSize: 28, letterSpacing: "-0.02em", color: "#FFF8E6", lineHeight: 1 }}>wali</span>
        </a>
        <a href="/crm/" style={{ background: "#FFD21F", color: "#09090e", fontWeight: 600, fontSize: 14, borderRadius: 999, padding: "9px 18px", textDecoration: "none", fontFamily: "var(--font-inter), system-ui, sans-serif" }}>Ingresar</a>
      </nav>
    </header>
  );
}
