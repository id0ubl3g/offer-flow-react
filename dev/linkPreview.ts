import { lookup } from "node:dns/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import net from "node:net";
import type { Plugin } from "vite";

const USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const CRAWLER_USER_AGENT = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";
const BLOCKED_PATTERN = /account-verification|captcha|\/challenge|\/blocked/i;
const MAX_HTML_BYTES = 3 * 1024 * 1024;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 12000;

function isPrivateAddress(address: string): boolean {
  if (net.isIPv4(address)) {
    const [a, b] = address.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }

  const normalized = address.toLowerCase();
  return normalized === "::1" || normalized === "::" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80") || normalized.startsWith("::ffff:") && isPrivateAddress(normalized.slice(7));
}

async function assertPublicUrl(raw: string): Promise<URL> {
  const url = new URL(raw);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https links are supported");
  }

  const addresses = await lookup(url.hostname, { all: true });

  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error("This address is not allowed");
  }

  return url;
}

async function safeFetch(raw: string, accept: string, userAgent = USER_AGENT): Promise<Response> {
  let url = await assertPublicUrl(raw);

  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "User-Agent": userAgent, Accept: accept, "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8" }
    });

    const location = response.headers.get("location");

    if (response.status >= 300 && response.status < 400 && location) {
      url = await assertPublicUrl(new URL(location, url).toString());
      continue;
    }

    return response;
  }

  throw new Error("Too many redirects");
}

async function readLimited(response: Response, limit: number): Promise<Buffer> {
  const reader = response.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;

  if (!reader) {
    return Buffer.alloc(0);
  }

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    size += value.length;

    if (size > limit) {
      await reader.cancel();
      throw new Error("Content is too large");
    }

    chunks.push(value);
  }

  return Buffer.concat(chunks);
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .trim();
}

function attribute(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i"));
  return match ? decodeEntities(match[2] ?? match[3] ?? "") : null;
}

function findMeta(html: string, keys: string[]): string | null {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];

  for (const key of keys) {
    for (const tag of tags) {
      const name = attribute(tag, "property") ?? attribute(tag, "name") ?? attribute(tag, "itemprop");

      if (name?.toLowerCase() === key) {
        const content = attribute(tag, "content");

        if (content) {
          return content;
        }
      }
    }
  }

  return null;
}

function findJsonLdImage(html: string): string | null {
  const blocks = html.match(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) ?? [];

  for (const block of blocks) {
    const json = block.replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, "");

    try {
      const queue: unknown[] = [JSON.parse(json)];

      while (queue.length) {
        const node = queue.shift();

        if (Array.isArray(node)) {
          queue.push(...node);
        } else if (node && typeof node === "object") {
          const record = node as Record<string, unknown>;
          const image = record.image;

          if (typeof image === "string") {
            return image;
          }

          if (Array.isArray(image) && typeof image[0] === "string") {
            return image[0];
          }

          if (image && typeof image === "object" && typeof (image as Record<string, unknown>).url === "string") {
            return (image as Record<string, string>).url;
          }

          queue.push(...Object.values(record));
        }
      }
    } catch {
      continue;
    }
  }

  return null;
}

function findJsonLdName(html: string): string | null {
  const blocks = html.match(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) ?? [];

  for (const block of blocks) {
    try {
      const queue: unknown[] = [JSON.parse(block.replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, ""))];

      while (queue.length) {
        const node = queue.shift();

        if (Array.isArray(node)) {
          queue.push(...node);
        } else if (node && typeof node === "object") {
          const record = node as Record<string, unknown>;

          if (/product/i.test(String(record["@type"] ?? "")) && typeof record.name === "string") {
            return decodeEntities(record.name);
          }

          queue.push(...Object.values(record));
        }
      }
    } catch {
      continue;
    }
  }

  return null;
}

function findHeading(html: string): string | null {
  const match = html.match(/<h1\b[^>]*>([\s\S]{1,600}?)<\/h1>/i);
  const text = match ? decodeEntities(match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")) : "";

  return text.length >= 3 ? text : null;
}

function findInlineImage(html: string): string | null {
  const patterns = [
    /data-old-hires\s*=\s*"(https?:[^"]+)"/i,
    /"hiRes"\s*:\s*"(https?:[^"]+)"/i,
    /"large"\s*:\s*"(https?:[^"]+\.(?:jpe?g|png|webp)[^"]*)"/i,
    /<img\b[^>]*id\s*=\s*["']landingImage["'][^>]*\ssrc\s*=\s*"(https?:[^"]+)"/i
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);

    if (match) {
      return decodeEntities(match[1]).replace(/\\u002F/gi, "/").replace(/\\\//g, "/");
    }
  }

  return null;
}

function parsePrice(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? Math.round(value * 100) : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  let text = value.replace(/[^\d.,]/g, "").replace(/^[.,]+|[.,]+$/g, "");

  if (!/\d/.test(text)) {
    return null;
  }

  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");

  if (lastComma > -1 && lastDot > -1) {
    const decimal = lastComma > lastDot ? "," : ".";
    text = text.split(decimal === "," ? "." : ",").join("").replace(decimal, ".");
  } else if (lastComma > -1) {
    text = text.split(".").join("").replace(/,(?=[^,]*$)/, ".").replace(/,/g, "");
  } else if (lastDot > -1 && (text.split(".").length > 2 || text.length - lastDot - 1 === 3)) {
    text = text.replace(/\./g, "");
  }

  const amount = Number(text);

  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : null;
}

function isStrikePrice(type: unknown): boolean {
  return typeof type === "string" && /strikethrough|listprice|msrp/i.test(type);
}

function findJsonLdPrices(html: string): { price: number | null; original: number | null } {
  const blocks = html.match(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  let price: number | null = null;
  let original: number | null = null;

  for (const block of blocks) {
    const json = block.replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, "");

    try {
      const queue: unknown[] = [JSON.parse(json)];

      while (queue.length) {
        const node = queue.shift();

        if (Array.isArray(node)) {
          queue.push(...node);
          continue;
        }

        if (!node || typeof node !== "object") {
          continue;
        }

        const record = node as Record<string, unknown>;
        const type = String(record["@type"] ?? "");

        if (/offer/i.test(type) || record.priceCurrency || record.price !== undefined) {
          const value = parsePrice(record.price ?? record.lowPrice);

          if (isStrikePrice(record.priceType)) {
            original ??= value;
          } else if (value) {
            price ??= value;
          }
        }

        if (/pricespecification/i.test(type) && isStrikePrice(record.priceType)) {
          original ??= parsePrice(record.price);
        }

        queue.push(...Object.values(record));
      }
    } catch {
      continue;
    }
  }

  return { price, original };
}

function findPattern(html: string, patterns: RegExp[]): number | null {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    const value = match ? parsePrice(match.slice(1).filter(Boolean).join(",")) : null;

    if (value) {
      return value;
    }
  }

  return null;
}

function extractPrices(html: string): { price_cents: number | null; original_price_cents: number | null } {
  const jsonLd = findJsonLdPrices(html);

  const price =
    findPattern(html, [
      /id\s*=\s*["'](?:corePrice_feature_div|corePriceDisplay_desktop_feature_div|apex_desktop)["'][\s\S]{0,4000}?class\s*=\s*["']a-offscreen["'][^>]*>\s*([^<]+)</i,
      /class\s*=\s*["'][^"']*priceToPay[^"']*["'][\s\S]{0,800}?class\s*=\s*["']a-offscreen["'][^>]*>\s*([^<]+)</i
    ]) ??
    jsonLd.price ??
    parsePrice(findMeta(html, ["product:price:amount", "og:price:amount", "price", "twitter:data1"])) ??
    findPattern(html, [/"priceAmount"\s*:\s*([\d.]+)/i, /"price"\s*:\s*"?([\d.,]+)"?/i]);

  let original =
    findPattern(html, [
      /class\s*=\s*["'][^"']*a-text-price[^"']*["'][^>]*data-a-strike\s*=\s*["']true["'][\s\S]{0,300}?class\s*=\s*["']a-offscreen["'][^>]*>\s*([^<]+)</i,
      /data-a-strike\s*=\s*["']true["'][\s\S]{0,300}?class\s*=\s*["']a-offscreen["'][^>]*>\s*([^<]+)</i,
      /andes-money-amount--previous[\s\S]{0,600}?andes-money-amount__fraction[^>]*>([\d.]+)<[\s\S]{0,200}?(?:andes-money-amount__cents[^>]*>(\d{2})<)?/i
    ]) ??
    jsonLd.original ??
    parsePrice(findMeta(html, ["product:original_price:amount", "og:original_price:amount"])) ??
    findPattern(html, [/"(?:original_price|originalPrice|list_price|listPrice|basisPrice)"\s*:\s*\{?[^}]{0,40}?"?([\d.,]+)"?/i]);

  if (!price || (original !== null && original <= price)) {
    original = null;
  }

  return { price_cents: price, original_price_cents: original };
}

function cleanTitle(title: string, base: string): string {
  return stripSiteName(title.replace(/\s*[|\-–—:]?\s*R\$\s*[\d.,]+\s*$/i, "").trim(), base);
}

function stripSiteName(title: string, base: string): string {
  const brand = new URL(base).hostname.replace(/^www\./, "").split(".")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
  const parts = title.split(/\s+[|\-–—]\s+/);
  const last = parts[parts.length - 1].toLowerCase().replace(/[^a-z0-9]/g, "");

  if (parts.length > 1 && brand.length >= 3 && last.includes(brand)) {
    return title.slice(0, title.lastIndexOf(parts[parts.length - 1])).replace(/\s+[|\-–—]\s*$/, "").trim();
  }

  return title;
}

function extractPreview(html: string, base: string): { image: string | null; title: string | null; price_cents: number | null; original_price_cents: number | null } {
  const image =
    findMeta(html, ["og:image:secure_url", "og:image", "og:image:url", "twitter:image", "twitter:image:src", "image"]) ??
    findJsonLdImage(html) ??
    attribute(html.match(/<link\b[^>]*rel\s*=\s*["']image_src["'][^>]*>/i)?.[0] ?? "", "href") ??
    findInlineImage(html);

  const title =
    findMeta(html, ["og:title", "twitter:title"]) ??
    findJsonLdName(html) ??
    findHeading(html) ??
    (decodeEntities(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? "") || null);

  return {
    image: image ? new URL(image, base).toString() : null,
    title: title ? cleanTitle(title, base) : null,
    ...extractPrices(html)
  };
}

type Preview = ReturnType<typeof extractPreview>;

async function fetchPreview(url: string, userAgent: string): Promise<{ preview: Preview | null; error: string | null }> {
  try {
    const response = await safeFetch(url, "text/html,application/xhtml+xml", userAgent);

    if (!response.ok) {
      return { preview: null, error: `The site answered with status ${response.status}` };
    }

    const html = (await readLimited(response, MAX_HTML_BYTES)).toString("utf8");

    if (BLOCKED_PATTERN.test(response.url) || /validateCaptcha|g-recaptcha|cf-challenge/i.test(html.slice(0, 20000))) {
      return { preview: null, error: "The site blocked the request" };
    }

    return { preview: extractPreview(html, response.url || url), error: null };
  } catch (error) {
    return { preview: null, error: error instanceof Error ? error.message : "Could not read the link" };
  }
}

function isComplete(preview: Preview | null): boolean {
  return !!preview?.image && !!preview.title && !!preview.price_cents;
}

function merge(first: Preview | null, second: Preview | null): Preview | null {
  if (!first || !second) {
    return first ?? second;
  }

  return {
    image: first.image ?? second.image,
    title: first.title ?? second.title,
    price_cents: first.price_cents ?? second.price_cents,
    original_price_cents: first.original_price_cents ?? second.original_price_cents
  };
}

export async function readLinkPreview(url: string): Promise<Preview> {
  const browser = await fetchPreview(url, USER_AGENT);

  if (isComplete(browser.preview)) {
    return browser.preview as Preview;
  }

  const crawler = await fetchPreview(url, CRAWLER_USER_AGENT);
  const preview = merge(crawler.preview, browser.preview);

  if (!preview) {
    throw new Error(browser.error ?? crawler.error ?? "Could not read the link");
  }

  return preview;
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function targetUrl(req: IncomingMessage): string | null {
  return new URL(req.url ?? "", "http://localhost").searchParams.get("url");
}

export function linkPreview(): Plugin {
  return {
    name: "offer-flow-link-preview",
    configureServer(server) {
      server.middlewares.use("/__link-preview", async (req, res) => {
        const url = targetUrl(req);

        if (!url) {
          return sendJson(res, 400, { error: "Missing url" });
        }

        try {
          sendJson(res, 200, await readLinkPreview(url));
        } catch (error) {
          sendJson(res, 502, { error: error instanceof Error ? error.message : "Could not read the link" });
        }
      });

      server.middlewares.use("/__image-proxy", async (req, res) => {
        const url = targetUrl(req);

        if (!url) {
          return sendJson(res, 400, { error: "Missing url" });
        }

        try {
          const accept = "image/avif,image/webp,image/png,image/jpeg,image/*";
          const isImage = (response: Response) => response.ok && (response.headers.get("content-type") ?? "").startsWith("image/");
          let response = await safeFetch(url, accept);

          if (!isImage(response)) {
            response = await safeFetch(url, accept, CRAWLER_USER_AGENT);
          }

          const contentType = response.headers.get("content-type") ?? "";

          if (!isImage(response)) {
            return sendJson(res, 502, { error: "The link did not return an image" });
          }

          const body = await readLimited(response, MAX_IMAGE_BYTES);

          res.statusCode = 200;
          res.setHeader("Content-Type", contentType);
          res.end(body);
        } catch (error) {
          sendJson(res, 502, { error: error instanceof Error ? error.message : "Could not download the image" });
        }
      });
    }
  };
}
