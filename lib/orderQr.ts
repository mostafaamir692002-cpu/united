import QRCode from "qrcode";

/** Real, scannable QR pointing straight at the order — not decoration. Rendered
 * inline as SVG (no image asset / network round-trip) so it always prints crisp
 * at any size and never breaks if the tablet later goes offline. */
export async function orderQrSvg(url: string, size = 132) {
  return QRCode.toString(url, {
    type: "svg",
    margin: 1,
    width: size,
    color: { dark: "#1a2e1a", light: "#ffffff" },
  });
}
