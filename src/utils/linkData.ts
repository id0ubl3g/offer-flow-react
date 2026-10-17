const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_DIMENSION = 1600;

export type LinkData = {
  file: File | null;
  title: string | null;
  priceCents: number | null;
  originalPriceCents: number | null;
  imageError: string | null;
};

async function readError(response: Response, fallback: string): Promise<string> {
  const data = await response.json().catch(() => null);
  return data?.error ?? fallback;
}

async function normalize(blob: Blob): Promise<File> {
  const bitmap = await createImageBitmap(blob).catch(() => null);

  if (!bitmap) {
    throw new Error("Não foi possível ler a imagem do link.");
  }

  const largest = Math.max(bitmap.width, bitmap.height);
  const fits = ACCEPTED_TYPES.includes(blob.type) && blob.size <= MAX_UPLOAD_BYTES && largest <= MAX_DIMENSION * 1.5;

  if (fits) {
    bitmap.close();
    return new File([blob], `produto.${blob.type.split("/")[1].replace("jpeg", "jpg")}`, { type: blob.type });
  }

  const scale = Math.min(1, MAX_DIMENSION / largest);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Não foi possível processar a imagem.");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));

  if (!jpeg) {
    throw new Error("Não foi possível converter a imagem.");
  }

  return new File([jpeg], "produto.jpg", { type: "image/jpeg" });
}

const DEV_ONLY = "A busca pelo link só funciona com o frontend rodando em npm run dev.";

async function downloadImage(image: string): Promise<File> {
  const download = await fetch(`/__image-proxy?url=${encodeURIComponent(image)}`);

  if (!download.ok) {
    throw new Error(`Não foi possível baixar a imagem: ${await readError(download, "erro desconhecido")}`);
  }

  return normalize(await download.blob());
}

export async function fetchLinkData(url: string): Promise<LinkData> {
  let preview: Response;

  try {
    preview = await fetch(`/__link-preview?url=${encodeURIComponent(url)}`);
  } catch {
    throw new Error(DEV_ONLY);
  }

  if (preview.status === 404) {
    throw new Error(DEV_ONLY);
  }

  if (!preview.ok) {
    throw new Error(`Não foi possível abrir o link: ${await readError(preview, "erro desconhecido")}`);
  }

  const data = (await preview.json()) as { image: string | null; title: string | null; price_cents: number | null; original_price_cents: number | null };
  let file: File | null = null;
  let imageError: string | null = data.image ? null : "Não encontramos uma imagem de produto nesse link.";

  if (data.image) {
    try {
      file = await downloadImage(data.image);
    } catch (err) {
      imageError = err instanceof Error ? err.message : "Não foi possível baixar a imagem.";
    }
  }

  return {
    file,
    title: data.title,
    priceCents: data.price_cents,
    originalPriceCents: data.original_price_cents,
    imageError
  };
}
