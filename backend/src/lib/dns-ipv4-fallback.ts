import dns, { type LookupAllOptions, type LookupOptions } from "node:dns";

/**
 * Some home routers answer DNS unreliably: they refuse AAAA (IPv6) queries and sometimes drop plain
 * IPv4 queries too, so getaddrinfo intermittently fails with ENOTFOUND for hosts that do exist.
 * When a lookup fails that way we retry it as IPv4-only, and if the router still fails, ask public
 * DNS servers directly.
 *
 * Patched process-wide because pg sockets and fetch (Neon Auth JWKS) both resolve via dns.lookup.
 * Must be imported before anything opens a connection.
 */
const RETRYABLE = new Set(["ENOTFOUND", "EAI_AGAIN"]);
const originalLookup = dns.lookup;

const publicResolver = new dns.Resolver({ timeout: 3000, tries: 2 });
publicResolver.setServers(["1.1.1.1", "8.8.8.8", "1.0.0.1", "8.8.4.4"]);

type Callback = (err: NodeJS.ErrnoException | null, ...result: unknown[]) => void;
type Lookup = (host: string, opts: LookupOptions, cb: Callback) => void;

const isRetryable = (err: NodeJS.ErrnoException | null) => !!err && RETRYABLE.has(err.code ?? "");

/** Resolve an IPv4 address via public DNS, answering in the same shape dns.lookup would. */
function lookupViaPublicDns(hostname: string, options: LookupOptions, originalErr: Error, callback: Callback) {
  publicResolver.resolve4(hostname, (err, addresses) => {
    if (err || addresses.length === 0) {
      callback(originalErr);
      return;
    }
    if (options.all) {
      callback(null, addresses.map((address) => ({ address, family: 4 })));
    } else {
      callback(null, addresses[0], 4);
    }
  });
}

function lookupWithFallback(
  hostname: string,
  optionsOrCallback: number | LookupOptions | LookupAllOptions | Callback,
  maybeCallback?: Callback,
): void {
  const callback = (typeof optionsOrCallback === "function" ? optionsOrCallback : maybeCallback) as Callback;
  const options: LookupOptions =
    typeof optionsOrCallback === "function"
      ? {}
      : typeof optionsOrCallback === "number"
        ? { family: optionsOrCallback }
        : { ...optionsOrCallback };

  const lookup = originalLookup as unknown as Lookup;
  const canUseIpv4 = !options.family || options.family === 4;

  lookup(hostname, options, (err, ...result) => {
    if (!isRetryable(err) || !canUseIpv4) {
      callback(err, ...result);
      return;
    }
    const ipv4Options = { ...options, family: 4 };
    lookup(hostname, ipv4Options, (retryErr, ...retryResult) => {
      if (isRetryable(retryErr)) {
        lookupViaPublicDns(hostname, ipv4Options, err!, callback);
        return;
      }
      callback(retryErr, ...retryResult);
    });
  });
}

dns.lookup = lookupWithFallback as typeof dns.lookup;
