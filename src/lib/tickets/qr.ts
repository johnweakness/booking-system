import QRCode from 'qrcode';

/** Generates a QR code as a data URL (PNG) encoding the ticket's UUID. */
export async function generateTicketQRDataUrl(ticketUuid: string): Promise<string> {
  // The QR payload is just the ticket UUID; gate scanners / POS call
  // POST /api/tickets/validate with { ticketUuid } to look it up and mark it used.
  return QRCode.toDataURL(ticketUuid, { errorCorrectionLevel: 'M', margin: 1, width: 320 });
}
