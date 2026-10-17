import { ArrowRight, CalendarClock, Check, CircleHelp, ListOrdered, MessageCircle, Tag, Users, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { Offer, Paginated } from "../api/types";
import { useLive } from "../live/LiveContext";

const SEEN_KEY = "offer-flow.onboarding-seen";

type Step = { done: boolean; title: string; text: string; cta: string; to: string };

const FLOW = [
  { icon: Tag, title: "Oferta", text: "Produto, preço, link e imagem." },
  { icon: ListOrdered, title: "Fila", text: "Ordem em que as ofertas saem." },
  { icon: CalendarClock, title: "Horário", text: "Cada horário envia a primeira da fila." },
  { icon: Users, title: "Grupos", text: "Recebem com um intervalo entre cada um." }
];

const TIPS = [
  { title: "Etiquetas", text: "Dê etiquetas às ofertas e aos grupos para que cada grupo receba só o que combina com ele. Grupos sem etiqueta recebem tudo." },
  { title: "Envio de teste", text: "Use o ícone de enviar no card da oferta para ver a mensagem num grupo antes de colocá-la na fila." },
  { title: "Ritmo de envio", text: "Em Horários, ajuste o intervalo entre grupos e o limite diário para reduzir o risco de bloqueio do número." },
  { title: "Histórico", text: "Cada disparo mostra o resultado por grupo. Falhas podem ser reenviadas de lá." }
];

const GUIDES = [
  {
    title: "Como vender mais",
    items: [
      { title: "Desconto real chama atenção", text: "Mostre o preço de antes e o de agora. Ofertas acima de 20% de desconto costumam ter mais cliques, e o Offer Flow já calcula e destaca o percentual." },
      { title: "Uma oferta por vez", text: "Mensagens com um único produto, foto boa e link direto convertem mais do que listas longas. É exatamente o formato que a fila envia." },
      { title: "Crie urgência sem exagero", text: "Frases como \"válido até acabar o estoque\" ou \"só hoje\" funcionam quando são verdade. Promessa falsa derruba a confiança do grupo." },
      { title: "Horário certo", text: "Os picos de leitura costumam ser no café da manhã, no almoço e à noite. Comece com 09:00, 12:30 e 20:00 e ajuste pelo Histórico." }
    ]
  },
  {
    title: "Escolha de produtos",
    items: [
      { title: "Produtos nichados vendem mais", text: "Um grupo de pets, de maquiagem ou de ferramentas tem público que já quer aquilo. Quanto mais específico o nicho, maior a taxa de clique e menor a saída de membros." },
      { title: "Use etiquetas por nicho", text: "Etiquete ofertas e grupos com o mesmo nicho, como pet ou casa. Cada grupo recebe só o que combina com ele, sem você separar nada na mão." },
      { title: "Prefira o que resolve um problema", text: "Itens úteis do dia a dia, com boa avaliação e entrega rápida, geram menos dúvida e mais compra por impulso." },
      { title: "Varie preço e categoria", text: "Alterne produtos baratos, que geram volume, com alguns de ticket maior, que aumentam a comissão por venda." }
    ]
  },
  {
    title: "Como crescer os grupos",
    items: [
      { title: "Deixe claro o que o grupo entrega", text: "Nome e descrição diretos, como \"Ofertas Pet - descontos diários\", atraem quem tem interesse de verdade." },
      { title: "Constância gera confiança", text: "Ofertas todos os dias nos mesmos horários fazem os membros criarem o hábito de olhar o grupo. A fila e os horários garantem isso mesmo quando você não está disponível." },
      { title: "Peça indicação", text: "De tempos em tempos, convide os membros a compartilhar o link do grupo com quem também gosta do nicho." },
      { title: "Qualidade acima de quantidade", text: "Poucas ofertas boas por dia mantêm o grupo vivo. Excesso de mensagens faz as pessoas silenciarem ou saírem." }
    ]
  },
  {
    title: "Divulgação",
    items: [
      { title: "Leve o link do grupo para as redes", text: "Coloque o convite na bio do Instagram e do TikTok e em stories com uma oferta de exemplo, mostrando o tipo de desconto que o grupo recebe." },
      { title: "Mostre resultados", text: "Prints de ofertas que esgotaram ou de membros que compraram são a melhor propaganda para novos membros." },
      { title: "Parcerias com outros grupos", text: "Troque divulgação com administradores de nichos parecidos, sem concorrer diretamente." },
      { title: "Respeite as regras", text: "Envie só para grupos que esperam suas ofertas. Spam em grupos alheios gera denúncia e aumenta o risco de bloqueio do número." }
    ]
  }
];

const PAINS = [
  { title: "Link grupo a grupo", text: "Copiar, colar e enviar a mesma oferta em cada grupo leva minutos por oferta e horas por semana." },
  { title: "Divulgação manual", text: "Se você para, os grupos param. Viagem, trabalho ou um dia corrido deixam os membros sem ofertas." },
  { title: "Sem programação", text: "Sem horário fixo, as ofertas saem quando dá, e não quando o público está lendo." },
  { title: "Risco de bloqueio", text: "Enviar tudo de uma vez, em sequência rápida, é o padrão que mais chama atenção do WhatsApp." }
];

const ADVANTAGES = [
  { title: "Cadastre uma vez, envie para todos", text: "A oferta vai para todos os grupos ativos automaticamente, com imagem, preço e link." },
  { title: "Fila e horários", text: "Monte a fila com antecedência e o Offer Flow dispara nos horários que você escolheu, todos os dias." },
  { title: "Cada grupo recebe o que combina", text: "As etiquetas direcionam cada oferta para os grupos do nicho certo." },
  { title: "Envio com ritmo humano", text: "Intervalos aleatórios entre grupos e limite diário reduzem o risco de bloqueio." },
  { title: "Histórico e reenvio", text: "Veja o que foi entregue em cada grupo e reenvie as falhas com um clique." }
];

function readSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return true;
  }
}

function markSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    return;
  }
}

export function Onboarding() {
  const { instance, groups, schedules, queue } = useLive();
  const navigate = useNavigate();
  const location = useLocation();
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"start" | "sell" | "why">("start");

  const loadOffers = useCallback(() => {
    api<Paginated<"offers", Offer>>("/offers?per_page=100").then((data) => setOffers(data.offers)).catch(() => setOffers([]));
  }, []);

  useEffect(loadOffers, [loadOffers, location.pathname]);

  const steps: Step[] = [
    { done: instance?.status === "open", title: "Conecte o WhatsApp", text: "Escaneie o QR code com o número que vai disparar as ofertas.", cta: "Conectar", to: "/whatsapp" },
    { done: !!groups?.some((group) => group.active && group.can_send), title: "Ative os grupos", text: "Sincronize e escolha quais grupos recebem as ofertas.", cta: "Escolher grupos", to: "/whatsapp" },
    { done: !!offers?.length, title: "Cadastre uma oferta", text: "Cole o link do produto, defina o preço e confira a prévia.", cta: "Nova oferta", to: "/offers?new=1" },
    { done: !!schedules?.some((schedule) => schedule.active), title: "Defina os horários", text: "Escolha quando disparar, como 09:00, 12:30 e 18:00.", cta: "Criar horário", to: "/schedules" },
    { done: !!queue?.length || !!offers?.some((offer) => offer.status === "sent"), title: "Coloque na fila", text: "Em Ofertas, use Pôr na fila. A cada horário a primeira da fila é enviada.", cta: "Ir para ofertas", to: "/offers" }
  ];
  const doneCount = steps.filter((step) => step.done).length;
  const remaining = steps.length - doneCount;
  const next = steps.findIndex((step) => !step.done);
  const loaded = offers !== null && groups !== null && schedules !== null && queue !== null;

  useEffect(() => {
    if (loaded && remaining > 0 && !readSeen()) {
      setOpen(true);
      markSeen();
    }
  }, [loaded, remaining]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handler = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  function go(to: string) {
    setOpen(false);
    navigate(to);
  }

  return (
    <>
      <button className="help-btn" onClick={() => setOpen(true)} aria-label="Ajuda e primeiros passos" title="Ajuda e primeiros passos">
        <CircleHelp size={17} />
        <span>Ajuda</span>
        {loaded && remaining > 0 && <span className="help-count">{remaining}</span>}
      </button>

      {open && createPortal(
        <div className="drawer-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
          <aside className="drawer" role="dialog" aria-modal="true" aria-label="Ajuda">
            <header className="drawer-header">
              <div>
                <div className="drawer-title">Como usar o Offer Flow</div>
                <div className="card-subtitle">{remaining ? `${doneCount} de ${steps.length} etapas concluídas` : "Tudo pronto. Os disparos já rodam sozinhos."}</div>
              </div>
              <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Fechar">
                <X size={18} />
              </button>
            </header>

            <nav className="tabs drawer-tabs">
              <button className={`tab ${tab === "start" ? "active" : ""}`} onClick={() => setTab("start")}>Começar</button>
              <button className={`tab ${tab === "sell" ? "active" : ""}`} onClick={() => setTab("sell")}>Vender mais</button>
              <button className={`tab ${tab === "why" ? "active" : ""}`} onClick={() => setTab("why")}>Por que usar</button>
            </nav>

            {tab === "start" && (
              <div className="drawer-body">
                <div className="progress">
                  <div style={{ width: `${(100 * doneCount) / steps.length}%` }} />
                </div>

                {next >= 0 && (
                  <section className="next-step">
                    <div className="eyebrow">Próximo passo</div>
                    <div className="next-step-title">{steps[next].title}</div>
                    <p className="muted">{steps[next].text}</p>
                    <button className="btn btn-primary" onClick={() => go(steps[next].to)}>
                      {steps[next].cta}
                      <ArrowRight size={15} />
                    </button>
                  </section>
                )}

                <section>
                  <div className="eyebrow">Primeiros passos</div>
                  <ol className="setup-steps">
                    {steps.map((step, index) => (
                      <li key={step.title}>
                        <button type="button" className={`setup-step ${step.done ? "done" : ""} ${index === next ? "current" : ""}`} onClick={() => go(step.to)}>
                          <span className="setup-index">{step.done ? <Check size={13} strokeWidth={3} /> : index + 1}</span>
                          <span className="grow">
                            <span className="setup-title">{step.title}</span>
                            <span className="setup-text">{step.text}</span>
                          </span>
                          <span className="setup-state">{step.done ? "Feito" : index === next ? "Agora" : ""}</span>
                        </button>
                      </li>
                    ))}
                  </ol>
                </section>

                <section>
                  <div className="eyebrow">Como funciona</div>
                  <div className="flow">
                    {FLOW.map(({ icon: Icon, title, text }) => (
                      <div key={title} className="flow-item">
                        <span className="flow-icon"><Icon size={15} /></span>
                        <span>
                          <span className="setup-title">{title}</span>
                          <span className="setup-text">{text}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <div className="eyebrow">Recursos</div>
                  <div className="tips">
                    {TIPS.map((tip) => (
                      <div key={tip.title} className="tip">
                        <div className="setup-title">{tip.title}</div>
                        <div className="setup-text">{tip.text}</div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {tab === "sell" && (
              <div className="drawer-body">
                {GUIDES.map((guide) => (
                  <section key={guide.title}>
                    <div className="eyebrow">{guide.title}</div>
                    <div className="tips">
                      {guide.items.map((item) => (
                        <div key={item.title} className="tip">
                          <div className="setup-title">{item.title}</div>
                          <div className="setup-text">{item.text}</div>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
                <div className="hint row">
                  <MessageCircle size={14} />
                  O risco de bloqueio do número é do dono da conta. Envie só para grupos que esperam suas ofertas.
                </div>
              </div>
            )}

            {tab === "why" && (
              <div className="drawer-body">
                <section>
                  <div className="next-step-title">Divulgar oferta não precisa ser um trabalho manual.</div>
                  <p className="muted" style={{ margin: "6px 0 0" }}>Quem vive de afiliado no WhatsApp conhece a rotina: abrir grupo por grupo, colar o mesmo link, repetir isso várias vezes por dia.</p>
                </section>
                <section>
                  <div className="eyebrow">Sem o Offer Flow</div>
                  <div className="compare">
                    {PAINS.map((item) => (
                      <div key={item.title} className="compare-item">
                        <span className="compare-icon pain"><X size={13} strokeWidth={2.5} /></span>
                        <span>
                          <span className="setup-title">{item.title}</span>
                          <span className="setup-text">{item.text}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
                <section>
                  <div className="eyebrow">Com o Offer Flow</div>
                  <div className="compare">
                    {ADVANTAGES.map((item) => (
                      <div key={item.title} className="compare-item">
                        <span className="compare-icon gain"><Check size={13} strokeWidth={2.5} /></span>
                        <span>
                          <span className="setup-title">{item.title}</span>
                          <span className="setup-text">{item.text}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
                {next >= 0 && (
                  <button className="btn btn-primary" onClick={() => setTab("start")}>
                    Ver primeiros passos
                    <ArrowRight size={15} />
                  </button>
                )}
              </div>
            )}
          </aside>
        </div>,
        document.body
      )}
    </>
  );
}
