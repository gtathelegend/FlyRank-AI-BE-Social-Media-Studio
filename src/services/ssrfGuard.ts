import { URL } from 'url';
import net from 'net';

export interface SsrfValidationResult {
  allowed: boolean;
  reason?: string;
}

export function validateUrlForSsrf(urlString: string): SsrfValidationResult {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(urlString);
  } catch {
    return { allowed: false, reason: 'Invalid URL format' };
  }

  // 1. Protocol check
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return { allowed: false, reason: `Forbidden URL scheme: ${parsedUrl.protocol}` };
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  // 2. Domain / Hostname checks
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.lan')
  ) {
    return { allowed: false, reason: 'Forbidden destination: internal domain or localhost' };
  }

  let cleanHost = hostname;
  if (cleanHost.startsWith('[') && cleanHost.endsWith(']')) {
    cleanHost = cleanHost.slice(1, -1);
  }

  // 3. IP Address checks
  if (net.isIP(cleanHost)) {
    if (isPrivateOrReservedIp(cleanHost)) {
      return { allowed: false, reason: 'Forbidden destination: private or loopback IP address' };
    }
  }

  return { allowed: true };
}

export function isPrivateOrReservedIp(ip: string): boolean {
  // IPv4 checks
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    const [a, b] = parts;

    // 0.0.0.0/8
    if (a === 0) return true;
    // Loopback 127.0.0.0/8
    if (a === 127) return true;
    // Private 10.0.0.0/8
    if (a === 10) return true;
    // Carrier Grade NAT 100.64.0.0/10
    if (a === 100 && b >= 64 && b <= 127) return true;
    // Link Local 169.254.0.0/16
    if (a === 169 && b === 254) return true;
    // Private 172.16.0.0/12 (172.16.0.0 – 172.31.255.255)
    if (a === 172 && b >= 16 && b <= 31) return true;
    // IETF Protocol Assignments 192.0.0.0/24
    if (a === 192 && b === 0) return true;
    // Documentation / Test 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24
    if (a === 192 && b === 0) return true;
    // Private 192.168.0.0/16
    if (a === 192 && b === 168) return true;
    // Multicast / Reserved 224.0.0.0/4 & 240.0.0.0/4
    if (a >= 224) return true;

    return false;
  }

  // IPv6 checks
  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    if (normalized === '::1' || normalized === '::') return true;
    if (normalized.startsWith('fe80:')) return true; // link-local
    if (normalized.startsWith('fc00:') || normalized.startsWith('fd00:')) return true; // unique local address
  }

  return false;
}
