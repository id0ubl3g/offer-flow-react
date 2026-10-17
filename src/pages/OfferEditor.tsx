import { ImageDown, ImagePlus, Smartphone, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { api } from "../api/client";
import type { Group, Offer, OfferInput } from "../api/types";
import { TagInput } from "../components/Tags";
import { useAuth } from "../auth/AuthContext";
import { MessageTemplateField } from "../components/MessageTemplate";
import { Modal, Spinner } from "../components/ui";
import { useToast } from "../components/Toast";
import { fetchLinkData } from "../utils/linkData";
import { getUserTemplate } from "../utils/template";
import { groupsForOffer } from "../utils/tags";
import { DEFAULT_TEMPLATE, centsFromInput, discountPercent, formatBRL, renderMessage, whatsappToHtml } from "../utils/format";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export function WhatsAppPreview({ text, imageUrl }: { text: string; imageUrl: string | null }) {
  const time = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="wa-preview">
      <div className="wa-preview-title">
        <Smartphone size={14} />
        Prévia no WhatsApp
      </div>
      <div className="wa-bubble">
        {imageUrl && <img src={imageUrl} alt="" />}
        <div className="wa-text" dangerouslySetInnerHTML={{ __html: whatsappToHtml(text) }} />
        <div className="wa-time">{time}</div>
      </div>
    </div>
  );
}

export function OfferEditor({ offer, groups, suggestions, onClose, onSaved }: { offer: Offer | null; groups: Group[]; suggestions: string[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [productName, setProductName] = useState(offer?.product_name ?? "");
  const [url, setUrl] = useState(offer?.url ?? "");
  const [original, setOriginal] = useState(offer?.original_price_cents ?? 0);
  const [price, setPrice] = useState(offer?.price_cents ?? 0);
  const [discountInput, setDiscountInput] = useState<string | null>(null);
  const { user } = useAuth();
  const defaultTemplate = getUserTemplate(user?.id);
  const [message, setMessage] = useState(offer ? offer.message ?? DEFAULT_TEMPLATE : defaultTemplate);
  const [tags, setTags] = useState<string[]>(offer?.tags ?? []);
  const [file, setFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [linkStatus, setLinkStatus] = useState<{ kind: "loading" | "error" | "success"; text: string } | null>(null);

  const localImage = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => () => {
    if (localImage) {
      URL.revokeObjectURL(localImage);
    }
  }, [localImage]);

  const imageUrl = localImage ?? (removeImage ? null : offer?.image_url ?? null);
  const discount = discountPercent(original, price);
  const targets = groupsForOffer({ tags }, groups);
  const priceError = price > original ? "O preço promocional não pode ser maior que o original." : "";
  const preview = renderMessage(message, {
    product_name: productName || "Nome do produto",
    price_cents: price,
    original_price_cents: original,
    url: url || "https://link-do-produto"
  });

  function priceFromDiscount(base: number, text: string): number {
    const percent = Math.min(99, parseFloat(text.replace(",", ".")) || 0);
    return Math.round(base * (1 - percent / 100));
  }

  function changeOriginal(value: number) {
    setOriginal(value);

    if (discountInput !== null) {
      setPrice(priceFromDiscount(value, discountInput));
    }
  }

  function changeDiscount(raw: string) {
    const text = raw.replace(/[^\d,.]/g, "").replace(".", ",").replace(/,(?=.*,)/g, "").replace(/^(\d{0,2})\d*(,\d?)?.*$/, "$1$2");

    setDiscountInput(text);
    setPrice(text ? priceFromDiscount(original, text) : original);
  }

  function changePrice(value: number) {
    setPrice(value);
    setDiscountInput(null);
  }

  function pickFile(selected: File | undefined) {
    if (!selected) {
      return;
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(selected.type)) {
      setError("A imagem precisa ser JPEG, PNG ou WEBP.");
      return;
    }

    if (selected.size > MAX_IMAGE_SIZE) {
      setError("A imagem precisa ter no máximo 5 MB.");
      return;
    }

    setError("");
    setFile(selected);
    setRemoveImage(false);
  }

  async function importFromLink(link = url) {
    const target = link.trim();

    if (!/^https?:\/\/\S+$/.test(target)) {
      setLinkStatus({ kind: "error", text: "Cole um link começando com http:// ou https://" });
      return;
    }

    setLinkStatus({ kind: "loading", text: "Buscando os dados do produto…" });

    try {
      const data = await fetchLinkData(target);
      const found: string[] = [];

      if (data.file) {
        setFile(data.file);
        setRemoveImage(false);
        setError("");
        found.push("imagem");
      }

      if (data.title) {
        setProductName(data.title.slice(0, 200));
        found.push("nome");
      }

      if (data.priceCents) {
        setOriginal(data.originalPriceCents ?? data.priceCents);
        setPrice(data.priceCents);
        setDiscountInput(null);
        found.push(data.originalPriceCents ? "preços" : "preço");
      }

      if (!found.length) {
        setLinkStatus({ kind: "error", text: data.imageError ?? "Não encontramos dados do produto nesse link." });
        return;
      }

      const list = found.length > 1 ? `${found.slice(0, -1).join(", ")} e ${found[found.length - 1]}` : found[0];
      const missing = data.file ? "" : " Não deu para pegar a imagem, adicione manualmente.";

      setLinkStatus({ kind: "success", text: `Preenchemos ${list} a partir do link. Confira antes de salvar.${missing}` });
    } catch (err) {
      setLinkStatus({ kind: "error", text: err instanceof Error ? err.message : "Não foi possível buscar os dados do link." });
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();

    if (priceError || !original || !price) {
      setError(priceError || "Informe os dois preços.");
      return;
    }

    setBusy(true);
    setError("");

    const payload: OfferInput = {
      product_name: productName.trim(),
      url: url.trim(),
      message: message.trim() && message !== DEFAULT_TEMPLATE ? message : null,
      original_price_cents: original,
      price_cents: price,
      tags
    };

    try {
      const saved = offer
        ? (await api<{ offer: Offer }>(`/offers/${offer.id}`, { method: "PATCH", body: payload })).offer
        : (await api<{ offer: Offer }>("/offers", { body: payload })).offer;

      if (file) {
        const form = new FormData();
        form.append("image", file);
        await api(`/offers/${saved.id}/image`, { method: "PUT", form });
      } else if (removeImage && offer?.image_path) {
        await api(`/offers/${saved.id}/image`, { method: "DELETE" });
      }

      toast.success(offer ? "Oferta atualizada" : "Oferta criada");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={offer ? "Editar oferta" : "Nova oferta"}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button className="btn btn-primary" form="offer-form" disabled={busy}>
            {busy && <Spinner />}
            {offer ? "Salvar alterações" : "Criar oferta"}
          </button>
        </>
      }
    >
      <div className="editor">
        <form id="offer-form" className="form-stack" onSubmit={submit}>
          {error && <div className="form-error">{error}</div>}
          <div className="field">
            <label className="label" htmlFor="url">Link do produto</label>
            <div className="row link-row">
              <input
                id="url"
                className="input"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData("text").trim();

                  if (/^https?:\/\/\S+$/.test(pasted)) {
                    setTimeout(() => importFromLink(pasted), 0);
                  }
                }}
                placeholder="https://amzn.to/..."
                pattern="https?://.+"
                required
                autoFocus
              />
              <button type="button" className="btn btn-secondary" style={{ height: 40 }} onClick={() => importFromLink()} disabled={linkStatus?.kind === "loading" || !url.trim()}>
                {linkStatus?.kind === "loading" ? <Spinner /> : <ImageDown size={15} />}
                Preencher pelo link
              </button>
            </div>
            {linkStatus && (
              <span className="hint" style={linkStatus.kind === "error" ? { color: "var(--danger)" } : linkStatus.kind === "success" ? { color: "var(--success)" } : undefined}>
                {linkStatus.text}
              </span>
            )}
          </div>
          <div className="field">
            <label className="label" htmlFor="product_name">Produto</label>
            <input id="product_name" className="input" value={productName} onChange={(e) => setProductName(e.target.value)} minLength={2} maxLength={200} placeholder="Fone JBL Tune 520BT" required />
          </div>
          <div className="form-row form-row-prices">
            <div className="field">
              <label className="label" htmlFor="original">Preço original</label>
              <input id="original" className="input" inputMode="numeric" value={`R$ ${formatBRL(original)}`} onChange={(e) => changeOriginal(centsFromInput(e.target.value))} />
            </div>
            <div className="field">
              <label className="label" htmlFor="discount">Desconto</label>
              <div className="input-suffix">
                <input id="discount" className="input" inputMode="decimal" value={discountInput ?? (discount ? String(discount) : "")} onChange={(e) => changeDiscount(e.target.value)} placeholder="0" disabled={!original} />
                <span>%</span>
              </div>
            </div>
            <div className="field">
              <label className="label" htmlFor="price">Preço promocional</label>
              <input id="price" className={`input ${priceError ? "invalid" : ""}`} inputMode="numeric" value={`R$ ${formatBRL(price)}`} onChange={(e) => changePrice(centsFromInput(e.target.value))} />
            </div>
          </div>
          <span className="hint" style={{ marginTop: -8, ...(priceError ? { color: "var(--danger)" } : {}) }}>
            {priceError || (discountInput !== null ? `Preço calculado com ${discountInput}% sobre o original.` : "Digite o preço promocional ou a % de desconto, um calcula o outro.")}
          </span>
          <div className="field">
            <label className="label" htmlFor="tags">Etiquetas</label>
            <TagInput id="tags" value={tags} onChange={setTags} suggestions={suggestions} placeholder="eletrônicos, casa, moda…" />
            <span className="hint" style={groups.length && !targets.length ? { color: "var(--warning)" } : undefined}>
              {!groups.length
                ? "Grupos sem etiqueta recebem todas as ofertas. Grupos com etiqueta só recebem ofertas com a mesma etiqueta."
                : targets.length
                  ? `Vai para ${targets.length} de ${groups.length} grupo${groups.length === 1 ? "" : "s"} ativo${groups.length === 1 ? "" : "s"}: ${targets.slice(0, 3).map((group) => group.name).join(", ")}${targets.length > 3 ? "…" : ""}`
                  : "Nenhum grupo ativo combina com essas etiquetas. A oferta será pulada na fila."}
            </span>
          </div>
          <MessageTemplateField
            id="message"
            label="Mensagem"
            value={message}
            onChange={setMessage}
            action={
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMessage(defaultTemplate)} disabled={message === defaultTemplate}>
                Usar meu padrão
              </button>
            }
          />
          <div className="field">
            <span className="label">Imagem</span>
            <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => pickFile(e.target.files?.[0])} />
            <div className="dropzone" onClick={() => fileInput.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pickFile(e.dataTransfer.files[0]); }}>
              {imageUrl ? <img src={imageUrl} alt="" className="thumb" /> : <div className="thumb"><ImagePlus size={20} /></div>}
              <div className="grow">
                <div style={{ fontWeight: 500 }}>{imageUrl ? "Trocar imagem" : "Adicionar imagem"}</div>
                <div className="hint">JPEG, PNG ou WEBP até 5 MB. Clique ou arraste.</div>
              </div>
              {imageUrl && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setFile(null); setRemoveImage(true); }}>
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        </form>
        <WhatsAppPreview text={preview} imageUrl={imageUrl} />
      </div>
    </Modal>
  );
}
