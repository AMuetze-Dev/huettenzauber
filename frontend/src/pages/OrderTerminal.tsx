import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUUpLeft,
  Basket,
  CaretUp,
  CheckCircle,
  Coins,
  GearSix,
  HandCoins,
  Minus,
  Money,
  Plus,
  ReceiptX,
  Star,
  Trash,
  X,
} from "@phosphor-icons/react";
import { api, ApiError } from "../api/client";
import { NumPad } from "../components/NumPad";
import { useToast } from "../components/Toast";
import { Topbar } from "../components/Topbar";
import topbar from "../components/Topbar.module.css";
import type { ActiveOrder, StockItem, Variant } from "../api/types";
import { euro, euroShort, toNumber } from "../lib/money";
import {
  cartReducer,
  cartTotals,
  emptyCart,
  type CartLine,
  type CartState,
  type CartTotals,
  type LineLookup,
} from "../order/cartReducer";
import { catIcon } from "../order/catIcon";
import { changeSuggestions, cents, COINS, NOTES } from "../order/change";
import { depositKinds, type DepositKind } from "../order/deposits";
import { useActiveOrderStream } from "../order/useActiveOrderStream";
import { useLongPress } from "../order/useLongPress";
import { useOrderData } from "../order/useOrderData";
import styles from "./OrderTerminal.module.css";

const LONG_PRESS_STEP = 5;

function lineFrom(item: StockItem, variant: Variant): Omit<CartLine, "qty"> {
  return {
    variantId: variant.id,
    stockItemId: item.id,
    itemName: item.name,
    variantLabel: variant.name || "Standard",
    unitPrice: toNumber(variant.price),
    deposit: toNumber(item.deposit_amount),
  };
}

/** Artikelfarbe als dezenter Anstrich - nie als einzige Information. */
function tint(color: string | null): React.CSSProperties | undefined {
  return color ? ({ "--item-color": color } as React.CSSProperties) : undefined;
}

function TopNav() {
  const navigate = useNavigate();
  return (
    <>
      <button
        className={topbar.navBtn}
        onClick={() => navigate("/verwaltung")}
        title="Verwaltung"
      >
        <GearSix size={16} />
        Verwaltung
      </button>
      <button className={topbar.navBtn} onClick={() => navigate("/bills")}>
        <ReceiptX size={16} />
        Rechnungen
      </button>
    </>
  );
}

export default function OrderTerminal() {
  const toast = useToast();
  const { loading, error, event, categories, items, favorites, reload } =
    useOrderData();
  const [cart, dispatch] = useReducer(cartReducer, emptyCart);
  const [catId, setCatId] = useState<number | null>(null);
  const [openItemId, setOpenItemId] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [pfandOpen, setPfandOpen] = useState(false);
  const [qtyLine, setQtyLine] = useState<CartLine | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (catId == null && categories.length) setCatId(categories[0].id);
  }, [categories, catId]);

  // Variante -> Anzeige-Metadaten. Braucht der Reducer, um Positionen zu
  // zeigen, die von einem zweiten Geraet kommen.
  const lookup = useMemo<LineLookup>(() => {
    const map = new Map<number, Omit<CartLine, "qty">>();
    for (const it of items)
      for (const v of it.variants) map.set(v.id, lineFrom(it, v));
    return (id) => map.get(id) ?? null;
  }, [items]);

  const applySnapshot = useCallback(
    (order: ActiveOrder) => {
      dispatch({
        type: "serverSnapshot",
        revision: order.revision,
        lines: order.lines.map((l) => ({
          variantId: l.item_variant_id,
          qty: toNumber(l.quantity),
        })),
        depositReturns: order.deposit_returns.map((d) => ({
          unitAmount: toNumber(d.unit_amount),
          quantity: d.quantity,
        })),
        lookup,
      });
    },
    [lookup],
  );

  // Der Server ist die Wahrheit - auch wenn nebenher ein Handy mittippt.
  const { order: streamed } = useActiveOrderStream();
  useEffect(() => {
    if (streamed) applySnapshot(streamed);
  }, [streamed, applySnapshot]);

  // Der Stand kann vor dem Katalog da sein: dann Namen und Preise nachziehen.
  useEffect(() => {
    dispatch({ type: "relabel", lookup });
  }, [lookup]);

  const totals = cartTotals(cart);
  const currentCat = categories.find((c) => c.id === catId) ?? null;
  const catItems = useMemo(
    () => items.filter((i) => i.category_id === catId),
    [items, catId],
  );
  // Pfandsorten kommen aus dem Katalog: der Bediener tippt das Gefaess an,
  // nicht den Betrag.
  const kinds = useMemo(() => depositKinds(items), [items]);
  // Jede Variante eines Favoriten wird eine eigene Kachel - ein Tipp, ein Artikel.
  const favTiles = useMemo(
    () =>
      favorites.flatMap((it) =>
        it.variants.map((v) => ({ item: it, variant: v, key: `${it.id}-${v.id}` })),
      ),
    [favorites],
  );

  async function bumpLine(line: Omit<CartLine, "qty">, step: number) {
    dispatch({ type: "bump", line, step });
    try {
      applySnapshot(await api.lineDelta(line.variantId, step));
    } catch (e) {
      dispatch({ type: "bumpFailed", variantId: line.variantId, step });
      toast.error(
        e instanceof ApiError && !e.isOffline
          ? e.detail
          : "Kasse nicht erreichbar – Position nicht übernommen.",
      );
    }
  }

  const bump = (item: StockItem, variant: Variant, step: number) =>
    bumpLine(lineFrom(item, variant), step);

  function undo() {
    if (cart.lastVariantId == null) return;
    const l = cart.lines.find((x) => x.variantId === cart.lastVariantId);
    if (l) void bumpLine(l, -1);
  }

  async function setQty(line: CartLine, target: number) {
    const delta = Math.max(0, target) - line.qty;
    setQtyLine(null);
    if (delta !== 0) await bumpLine(line, delta);
  }

  /** Stückzahl für EINE Pfandsorte setzen; andere Sorten bleiben stehen. */
  async function setDeposit(unitAmount: number, quantity: number) {
    const before =
      cart.depositReturns.find((d) => d.unitAmount === unitAmount)?.quantity ?? 0;
    dispatch({ type: "setDepositReturn", unitAmount, quantity });
    try {
      applySnapshot(
        await api.setDepositReturn(unitAmount.toFixed(2), Math.max(0, quantity)),
      );
    } catch (e) {
      dispatch({ type: "setDepositReturn", unitAmount, quantity: before });
      toast.error(
        e instanceof ApiError && !e.isOffline
          ? e.detail
          : "Pfandrückgabe nicht übernommen.",
      );
    }
  }

  async function clearDeposits() {
    dispatch({ type: "clearDepositReturns" });
    try {
      applySnapshot(await api.clearDepositReturns());
    } catch {
      toast.error("Pfandrückgabe nicht zurückgesetzt.");
    }
  }

  /** Leergut ohne Kauf: Geld raus, kein Bon. */
  async function payoutDeposits(entries: { unitAmount: number; quantity: number }[]) {
    const wanted = entries.filter((e) => e.quantity > 0 && e.unitAmount > 0);
    if (wanted.length === 0) return;
    setBusy(true);
    try {
      for (const e of wanted)
        await api.createDepositReturn(e.unitAmount.toFixed(2), e.quantity);
      const sum = wanted.reduce((a, e) => a + e.unitAmount * e.quantity, 0);
      const count = wanted.reduce((a, e) => a + e.quantity, 0);
      setPfandOpen(false);
      toast.success(`${count}× Pfand ausgezahlt · ${euro(sum)}`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.detail : "Auszahlung fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  /** Warenkorb verwerfen - muss den Server erreichen, sonst hängt das
   *  Kundendisplay auf dem alten Stand. */
  async function clearCart() {
    dispatch({ type: "clear" });
    setSheetOpen(false);
    try {
      applySnapshot(await api.clearOrder());
      toast.info("Bestellung verworfen");
    } catch (e) {
      toast.error(
        e instanceof ApiError && !e.isOffline
          ? e.detail
          : "Kasse nicht erreichbar – Bestellung eventuell noch offen.",
      );
    }
  }

  /**
   * Bon schreiben. `tip` ist das Geld, das der Gast dagelassen hat ("stimmt
   * so") - es wandert als Bargeldbewegung in die Kasse, nicht in den Umsatz.
   * Ohne das weist der Kassenschnitt abends einen Überschuss aus.
   */
  async function pay({ tip }: { tip: number } = { tip: 0 }) {
    if (busy || totals.count === 0) return;
    setBusy(true);
    const summe = totals.due;
    try {
      const bill = await api.createBill();
      dispatch({ type: "clear" });
      setPayOpen(false);
      setSheetOpen(false);
      toast.success(`Bon #${bill.id} · ${euro(summe)} kassiert`);

      if (tip > 0) {
        try {
          await api.addCashMovement(tip.toFixed(2), "Trinkgeld");
          toast.success(`${euro(tip)} Trinkgeld gebucht`);
        } catch {
          // Der Bon steht - nur das Trinkgeld fehlt. Sagen statt schlucken,
          // sonst sucht abends jemand die Differenz.
          toast.error(
            `Trinkgeld ${euro(tip)} nicht gebucht – im Kassenschnitt nachtragen.`,
          );
        }
      }
    } catch (e) {
      toast.error(
        e instanceof ApiError && !e.isOffline
          ? e.detail
          : "Bon konnte nicht erstellt werden. Bitte erneut versuchen.",
      );
    } finally {
      setBusy(false);
    }
  }

  const lastLine = cart.lines.find((l) => l.variantId === cart.lastVariantId);

  if (loading)
    return (
      <Screen>
        <div className={styles.notice}>
          <p>Katalog wird geladen …</p>
        </div>
      </Screen>
    );

  if (!event)
    return (
      <Screen>
        <div className={styles.notice}>
          <h1>{error ? "Kasse antwortet nicht" : "Keine aktive Veranstaltung"}</h1>
          <p>
            {error ??
              "Im Verwaltungsbereich eine Veranstaltung anlegen und aktivieren, dann erscheint hier der Katalog."}
          </p>
          <button className={styles.ghost} onClick={reload}>
            Neu laden
          </button>
        </div>
      </Screen>
    );

  return (
    <Screen>
      <div className={styles.middle}>
        <div className={styles.rail}>
          {categories.map((c) => {
            const Icon = catIcon(c);
            return (
              <button
                key={c.id}
                className={`${styles.railBtn} ${c.id === catId ? styles.active : ""}`}
                onClick={() => {
                  setCatId(c.id);
                  setOpenItemId(null);
                }}
              >
                <Icon size={25} />
                <span>{c.name}</span>
              </button>
            );
          })}
        </div>

        <div className={styles.main}>
          {favTiles.length > 0 && (
            <div className={styles.favBar}>
              <span className={styles.favLabel}>
                <Star size={13} weight="fill" />
                Schnellzugriff
              </span>
              <div className={styles.favRow}>
                {favTiles.map(({ item, variant, key }) => (
                  <FavTile
                    key={key}
                    item={item}
                    variant={variant}
                    qty={
                      cart.lines.find((l) => l.variantId === variant.id)?.qty ?? 0
                    }
                    onBump={(step) => bump(item, variant, step)}
                  />
                ))}
              </div>
            </div>
          )}

          <div className={styles.mainHead}>
            <h1>{currentCat?.name ?? "Kategorie wählen"}</h1>
            <span>{catItems.length} Artikel</span>
          </div>

          <div className={styles.grid}>
            {catItems.length === 0 && (
              <div className={styles.emptyState}>
                Keine Artikel in dieser Kategorie.
              </div>
            )}
            {catItems.map((item) => {
              const qtyForVariant = (vid: number) =>
                cart.lines.find((l) => l.variantId === vid)?.qty ?? 0;
              const total = item.variants.reduce(
                (a, v) => a + qtyForVariant(v.id),
                0,
              );
              if (item.variants.length === 1) {
                return (
                  <SingleTile
                    key={item.id}
                    item={item}
                    variant={item.variants[0]}
                    qty={total}
                    onBump={(step) => bump(item, item.variants[0], step)}
                  />
                );
              }
              return (
                <MultiCard
                  key={item.id}
                  item={item}
                  total={total}
                  open={openItemId === item.id}
                  onToggle={() =>
                    setOpenItemId((id) => (id === item.id ? null : item.id))
                  }
                  qtyForVariant={qtyForVariant}
                  onBump={(v, step) => bump(item, v, step)}
                />
              );
            })}
          </div>
        </div>
      </div>

      <div className={styles.footbar}>
        <button
          className={styles.iconBtn}
          onClick={undo}
          title="Letzte Position −1"
          aria-label="Letzte Position zurücknehmen"
          disabled={cart.lastVariantId == null}
        >
          <ArrowUUpLeft size={22} />
        </button>
        <button
          className={styles.iconBtn}
          onClick={() => setPfandOpen(true)}
          title="Pfandrückgabe"
          aria-label="Pfandrückgabe"
        >
          <Coins size={22} />
        </button>
        <button
          className={styles.cartBtn}
          onClick={() => setSheetOpen(true)}
          disabled={totals.count === 0}
          aria-label={`Warenkorb öffnen – ${totals.count} Artikel`}
        >
          <Basket size={22} color="var(--accent)" />
          <span>{totals.count} Artikel</span>
          <CaretUp size={14} color="var(--text-muted)" />
        </button>
        <span className={styles.last}>
          {lastLine
            ? `Zuletzt: ${lastLine.itemName}${lastLine.variantLabel !== "Standard" ? " · " + lastLine.variantLabel : ""}`
            : ""}
        </span>
        <span className={styles.dueLabel}>Zu zahlen</span>
        <span className={`${styles.dueValue} tnum`}>{euro(totals.due)}</span>
        <button
          className={styles.payBtn}
          disabled={totals.count === 0}
          onClick={() => setPayOpen(true)}
          aria-label={`Bar kassieren – ${euro(totals.due)}`}
        >
          <Money size={22} weight="fill" />
          Bar kassieren
        </button>
      </div>

      {sheetOpen && (
        <CartSheet
          cart={cart}
          totals={totals}
          onClose={() => setSheetOpen(false)}
          onClear={clearCart}
          onBumpLine={bumpLine}
          onEditQty={setQtyLine}
          onPfand={() => setPfandOpen(true)}
          onPay={() => setPayOpen(true)}
        />
      )}

      {qtyLine && (
        <QtyOverlay
          line={qtyLine}
          onCancel={() => setQtyLine(null)}
          onSubmit={(n) => void setQty(qtyLine, n)}
        />
      )}

      {pfandOpen && (
        <PfandOverlay
          kinds={kinds}
          inCart={cart.depositReturns}
          cartHasItems={totals.count > 0}
          busy={busy}
          onClose={() => setPfandOpen(false)}
          onToCart={(entries) => {
            void (async () => {
              for (const e of entries) await setDeposit(e.unitAmount, e.quantity);
              setPfandOpen(false);
            })();
          }}
          onClearCartDeposits={() => {
            void clearDeposits();
            setPfandOpen(false);
          }}
          onPayout={(entries) => void payoutDeposits(entries)}
        />
      )}

      {payOpen && (
        <PayOverlay
          due={totals.due}
          count={totals.count}
          busy={busy}
          onConfirm={pay}
          onBack={() => setPayOpen(false)}
        />
      )}
    </Screen>
  );
}

function Screen({ children }: { children: ReactNode }) {
  return (
    <div className={`${styles.screen} no-select`}>
      <Topbar>
        <TopNav />
      </Topbar>
      {children}
    </div>
  );
}

function FavTile({
  item,
  variant,
  qty,
  onBump,
}: {
  item: StockItem;
  variant: Variant;
  qty: number;
  onBump: (step: number) => void;
}) {
  const press = useLongPress(
    () => onBump(1),
    () => qty > 0 && onBump(-1),
  );
  return (
    <button
      className={`${styles.fav} ${qty > 0 ? styles.has : ""} ${item.color ? styles.tinted : ""}`}
      style={tint(item.color)}
      title="Tippen = +1, halten = −1"
      {...press}
    >
      <span className={styles.favName}>
        {item.name}
        {variant.name ? <small> {variant.name}</small> : null}
      </span>
      <b className="tnum">{euro(variant.price)}</b>
      {qty > 0 && <span className={styles.badge}>{qty}</span>}
    </button>
  );
}

function SingleTile({
  item,
  variant,
  qty,
  onBump,
}: {
  item: StockItem;
  variant: Variant;
  qty: number;
  onBump: (step: number) => void;
}) {
  const press = useLongPress(
    () => onBump(1),
    () => qty > 0 && onBump(-1),
  );
  const deposit = toNumber(item.deposit_amount);
  return (
    <div
      className={`${styles.card} ${qty > 0 ? styles.has : ""} ${item.color ? styles.tinted : ""}`}
      style={tint(item.color)}
    >
      <button className={styles.cardBtn} title="Tippen = +1, halten = −1" {...press}>
        <span className={styles.name}>{item.name}</span>
        <span className={styles.price}>
          <b>{euro(variant.price)}</b>
          {variant.name && <small>{variant.name}</small>}
        </span>
        {deposit > 0 && <span className={styles.dep}>+ {euro(deposit)} Pfand</span>}
        {qty > 0 && <span className={styles.badge}>{qty}</span>}
      </button>
    </div>
  );
}

function MultiCard({
  item,
  total,
  open,
  onToggle,
  qtyForVariant,
  onBump,
}: {
  item: StockItem;
  total: number;
  open: boolean;
  onToggle: () => void;
  qtyForVariant: (vid: number) => number;
  onBump: (v: Variant, step: number) => void;
}) {
  const prices = item.variants.map((v) => toNumber(v.price));
  const range =
    Math.min(...prices) === Math.max(...prices)
      ? euro(prices[0])
      : `${euro(Math.min(...prices))}–${euro(Math.max(...prices))}`;
  return (
    <div
      className={`${styles.card} ${total > 0 ? styles.has : ""} ${open ? styles.open : ""} ${item.color ? styles.tinted : ""}`}
      style={tint(item.color)}
    >
      <button className={styles.cardBtn} onClick={onToggle}>
        <span className={styles.name}>{item.name}</span>
        <span className={styles.price}>
          <b>{range}</b>
          <small>{item.variants.length} Größen</small>
        </span>
        {total > 0 && <span className={styles.badge}>{total}</span>}
      </button>
      {open && (
        <div className={styles.chips}>
          {item.variants.map((v) => (
            <VariantChip
              key={v.id}
              variant={v}
              qty={qtyForVariant(v.id)}
              onBump={(step) => onBump(v, step)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function VariantChip({
  variant,
  qty,
  onBump,
}: {
  variant: Variant;
  qty: number;
  onBump: (step: number) => void;
}) {
  const press = useLongPress(
    () => onBump(1),
    () => qty > 0 && onBump(-1),
  );
  return (
    <button className={`${styles.chip} ${qty > 0 ? styles.has : ""}`} {...press}>
      <span>{variant.name || "Standard"}</span>
      <b>{euro(variant.price)}</b>
      {qty > 0 && <span className={styles.badge}>{qty}</span>}
    </button>
  );
}

/** Stepper-Taste: Tippen ±1, Halten ±5 - spart Dauertippen bei Runden. */
function StepButton({
  dir,
  onStep,
  label,
}: {
  dir: 1 | -1;
  onStep: (step: number) => void;
  label: string;
}) {
  const press = useLongPress(
    () => onStep(dir),
    () => onStep(dir * LONG_PRESS_STEP),
  );
  return (
    <button
      className={styles.step}
      aria-label={label}
      title={`${label} (halten = ${LONG_PRESS_STEP})`}
      {...press}
    >
      {dir > 0 ? <Plus size={15} /> : <Minus size={15} />}
    </button>
  );
}

function CartSheet({
  cart,
  totals,
  onClose,
  onClear,
  onBumpLine,
  onEditQty,
  onPfand,
  onPay,
}: {
  cart: CartState;
  totals: CartTotals;
  onClose: () => void;
  onClear: () => void;
  onBumpLine: (line: CartLine, step: number) => void;
  onEditQty: (line: CartLine) => void;
  onPfand: () => void;
  onPay: () => void;
}) {
  const depQty = cart.depositReturns.reduce((a, d) => a + d.quantity, 0);
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.sheet}
        role="dialog"
        aria-label="Warenkorb"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.sheetHead}>
          <h2>Warenkorb</h2>
          <span className={styles.sheetHint}>
            {totals.count} Artikel · Menge antippen zum Ändern
          </span>
          <span className={styles.grow} />
          <button className={`${styles.ghost} ${styles.danger}`} onClick={onClear}>
            <Trash size={16} />
            Leeren
          </button>
          <button className={styles.ghost} onClick={onClose} aria-label="Schließen">
            <X size={16} />
          </button>
        </div>

        <div className={styles.sheetLines}>
          {cart.lines.map((l) => (
            <div key={l.variantId} className={styles.sheetLine}>
              <div className={styles.info}>
                <div className={styles.n}>{l.itemName}</div>
                <div className={styles.v}>{l.variantLabel}</div>
              </div>
              <div className={styles.stepper}>
                <StepButton dir={-1} onStep={(s) => onBumpLine(l, s)} label="weniger" />
                <button
                  className={`${styles.count} tnum`}
                  onClick={() => onEditQty(l)}
                  aria-label={`Menge für ${l.itemName} ändern`}
                >
                  {l.qty}
                </button>
                <StepButton dir={1} onStep={(s) => onBumpLine(l, s)} label="mehr" />
              </div>
              <span className={`${styles.lineSum} tnum`}>
                {euro(l.unitPrice * l.qty)}
              </span>
            </div>
          ))}
        </div>

        <div className={styles.sheetFoot}>
          <button
            className={`${styles.pfandBtn} ${depQty > 0 ? styles.has : ""}`}
            onClick={onPfand}
          >
            <Coins size={18} />
            {depQty > 0
              ? `${depQty} Pfand zurück · − ${euro(totals.depositReturn)}`
              : "Pfand zurück"}
          </button>
          <span className={`${styles.sheetTotal} tnum`}>{euro(totals.due)}</span>
          <button
            className={styles.payBtn}
            onClick={onPay}
            aria-label={`Bar kassieren – ${euro(totals.due)}`}
          >
            <Money size={22} weight="fill" />
            Bar kassieren
          </button>
        </div>
      </div>
    </div>
  );
}

function QtyOverlay({
  line,
  onCancel,
  onSubmit,
}: {
  line: CartLine;
  onCancel: () => void;
  onSubmit: (qty: number) => void;
}) {
  const [value, setValue] = useState(String(line.qty));
  const n = Math.max(0, Math.floor(Number(value) || 0));
  return (
    <div className={`${styles.overlay} ${styles.overlayCenter}`} onClick={onCancel}>
      <div
        className={styles.qtyCard}
        role="dialog"
        aria-label="Menge ändern"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.payHead}>
          <h2>{line.itemName}</h2>
          <span className={styles.sheetHint}>{line.variantLabel}</span>
        </div>
        <div className={styles.qtyChips}>
          {[1, 2, 3, 5, 10, 20].map((q) => (
            <button
              key={q}
              className={`${styles.qtyChip} ${n === q ? styles.qtySel : ""}`}
              onClick={() => setValue(String(q))}
            >
              {q}
            </button>
          ))}
        </div>
        <NumPad value={value} onChange={setValue} unit="Stück" decimals={false} />
        <div className={`${styles.qtySum} tnum`}>{euro(line.unitPrice * n)}</div>
        <button className={styles.confirmBtn} onClick={() => onSubmit(n)}>
          <CheckCircle size={22} weight="fill" />
          {n === 0 ? "Position entfernen" : `Menge auf ${n} setzen`}
        </button>
        <button className={styles.backBtn} onClick={onCancel}>
          Abbrechen
        </button>
      </div>
    </div>
  );
}

interface PfandEntry {
  unitAmount: number;
  quantity: number;
}

/**
 * Gemischtes Leergut in einem Rutsch: je Pfandsorte aus dem Katalog eine
 * Zeile mit Stückzahl. 3 Weingläser (2,00 €) + 2 Biergläser (1,50 €) = 9,00 €.
 */
function PfandOverlay({
  kinds,
  inCart,
  cartHasItems,
  busy,
  onClose,
  onToCart,
  onClearCartDeposits,
  onPayout,
}: {
  kinds: DepositKind[];
  inCart: PfandEntry[];
  cartHasItems: boolean;
  busy: boolean;
  onClose: () => void;
  onToCart: (entries: PfandEntry[]) => void;
  onClearCartDeposits: () => void;
  onPayout: (entries: PfandEntry[]) => void;
}) {
  // Katalogsorten plus alles, was schon im Vorgang steht (auch wenn der
  // zugehoerige Artikel inzwischen aus dem Katalog raus ist).
  const rows = useMemo<DepositKind[]>(() => {
    const merged = new Map(kinds.map((k) => [k.unitAmount, k]));
    for (const entry of inCart)
      if (!merged.has(entry.unitAmount))
        merged.set(entry.unitAmount, {
          unitAmount: entry.unitAmount,
          label: "Pfand",
          itemNames: [],
        });
    return [...merged.values()].sort((a, b) => a.unitAmount - b.unitAmount);
  }, [kinds, inCart]);

  const [qty, setQty] = useState<Record<number, number>>(() =>
    Object.fromEntries(inCart.map((e) => [e.unitAmount, e.quantity])),
  );

  const entries = rows
    .map((r) => ({ unitAmount: r.unitAmount, quantity: qty[r.unitAmount] ?? 0 }))
    .filter((e) => e.quantity > 0);
  const sum = entries.reduce((a, e) => a + e.unitAmount * e.quantity, 0);
  const pieces = entries.reduce((a, e) => a + e.quantity, 0);
  const hadDeposits = inCart.length > 0;

  const step = (unit: number, delta: number) =>
    setQty((q) => ({ ...q, [unit]: Math.max(0, (q[unit] ?? 0) + delta) }));

  return (
    <div className={`${styles.overlay} ${styles.overlayCenter}`} onClick={onClose}>
      <div
        className={styles.payCard}
        role="dialog"
        aria-label="Pfandrückgabe"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.payHead}>
          <h2>Pfandrückgabe</h2>
          <span className={styles.sheetHint}>
            {rows.length === 0
              ? "Im Katalog ist kein Pfand hinterlegt"
              : "Zurückgebrachtes Leergut zählen"}
          </span>
        </div>

        {rows.length === 0 ? (
          <p className={styles.pfandEmpty}>
            Pfandbeträge werden am Artikel gepflegt (Verwaltung → Katalog).
            Sobald dort ein Pfand steht, erscheint die Sorte hier.
          </p>
        ) : (
          <div className={styles.pfandRows}>
            {rows.map((r) => {
              const n = qty[r.unitAmount] ?? 0;
              return (
                <div
                  key={r.unitAmount}
                  className={`${styles.pfandRow} ${n > 0 ? styles.has : ""}`}
                >
                  <div className={styles.pfandInfo}>
                    <div className={styles.pfandName}>
                      {r.label || "Pfand"}
                    </div>
                    <div className={styles.pfandUnit}>
                      {euro(r.unitAmount)} je Stück
                    </div>
                  </div>
                  <div className={styles.stepper}>
                    <StepButton
                      dir={-1}
                      onStep={(s) => step(r.unitAmount, s)}
                      label={`${r.label || "Pfand"}: weniger`}
                    />
                    <span className={`${styles.count} tnum`}>{n}</span>
                    <StepButton
                      dir={1}
                      onStep={(s) => step(r.unitAmount, s)}
                      label={`${r.label || "Pfand"}: mehr`}
                    />
                  </div>
                  <span className={`${styles.lineSum} tnum`}>
                    {n > 0 ? `− ${euro(r.unitAmount * n)}` : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <div className={`${styles.payBig} tnum`}>
          − {euro(sum)}
          <small>{pieces} Stück</small>
        </div>

        <button
          className={styles.confirmBtn}
          disabled={!cartHasItems || busy || (entries.length === 0 && !hadDeposits)}
          onClick={() => (entries.length === 0 ? onClearCartDeposits() : onToCart(entries))}
          title={
            cartHasItems ? undefined : "Nur möglich, wenn etwas im Warenkorb liegt"
          }
        >
          <CheckCircle size={22} weight="fill" />
          {entries.length === 0 && hadDeposits
            ? "Pfandrückgabe entfernen"
            : "Von dieser Bestellung abziehen"}
        </button>
        <button
          className={styles.secondaryBtn}
          disabled={busy || entries.length === 0}
          onClick={() => onPayout(entries)}
        >
          <Coins size={20} />
          {euro(sum)} bar auszahlen (ohne Bon)
        </button>
        <button className={styles.backBtn} onClick={onClose} disabled={busy}>
          Abbrechen
        </button>
      </div>
    </div>
  );
}

/**
 * Bar kassieren.
 *
 * Der Gast legt hin, was er hat - 45 € bei 40,30 €, oder 42 €. Deshalb wird
 * die Stückelung angetippt und aufaddiert, statt einen Betrag zu suchen.
 * Bleibt etwas übrig und der Gast sagt "stimmt so", geht die Differenz als
 * Trinkgeld in die Kasse, sonst stimmt der Kassenschnitt abends nicht.
 */
function PayOverlay({
  due,
  count,
  busy,
  onConfirm,
  onBack,
}: {
  due: number;
  count: number;
  busy: boolean;
  onConfirm: (opts: { tip: number }) => void;
  onBack: () => void;
}) {
  const [received, setReceived] = useState(0);
  const [padOpen, setPadOpen] = useState(false);
  const [padValue, setPadValue] = useState("");

  const suggestions = useMemo(() => changeSuggestions(due), [due]);
  const change = cents(received - due);
  const nothingGiven = received === 0;
  const enough = change >= -0.005;
  const add = (value: number) => setReceived((r) => cents(r + value));

  const takePad = () => {
    setReceived(cents(toNumber(padValue)));
    setPadValue("");
    setPadOpen(false);
  };

  return (
    <div className={`${styles.overlay} ${styles.overlayCenter}`}>
      <div className={styles.payCard} role="dialog" aria-label="Bar kassieren">
        <div className={styles.payHead}>
          <h2>Bar kassieren</h2>
          <span className={styles.sheetHint}>{count} Artikel</span>
        </div>
        <div className={`${styles.payBig} tnum`}>
          {euro(due)}
          <small>inkl. Pfand</small>
        </div>

        {padOpen ? (
          <div className={styles.payPad}>
            <NumPad value={padValue} onChange={setPadValue} />
            <div className={styles.payPadRow}>
              <button className={styles.ghostWide} onClick={() => setPadOpen(false)}>
                Abbrechen
              </button>
              <button
                className={styles.ghostWide}
                disabled={padValue === ""}
                onClick={takePad}
              >
                {euro(toNumber(padValue))} übernehmen
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className={styles.quickRow}>
              <button
                className={`${styles.quickBtn} ${received === due ? styles.sel : ""}`}
                onClick={() => setReceived(due)}
              >
                <b className="tnum">passend</b>
                <small className="tnum">{euro(due)}</small>
              </button>
              {suggestions.map((v) => (
                <button
                  key={v}
                  className={`${styles.quickBtn} ${received === v ? styles.sel : ""}`}
                  onClick={() => setReceived(v)}
                >
                  <b className="tnum">{euroShort(v)}</b>
                  <small className="tnum">zurück {euro(cents(v - due))}</small>
                </button>
              ))}
              <button className={styles.quickBtn} onClick={() => setPadOpen(true)}>
                <b>Betrag</b>
                <small>frei eingeben</small>
              </button>
            </div>

            <div className={styles.denomRow}>
              <span className={styles.denomLabel}>Gast
                <br />gibt</span>
              <div className={styles.denomGroup} aria-label="Scheine">
                {NOTES.map((v) => (
                  <button
                    key={v}
                    className={styles.noteBtn}
                    aria-label={`${euroShort(v)} dazulegen`}
                    onClick={() => add(v)}
                  >
                    <span className="tnum">{v}</span>
                    <small>€</small>
                  </button>
                ))}
              </div>
              <span className={styles.denomSep} aria-hidden />
              <div className={styles.denomGroup} aria-label="Münzen">
                {COINS.map((v) => (
                  <button
                    key={v}
                    className={styles.coinBtn}
                    aria-label={`${euroShort(v)} dazulegen`}
                    onClick={() => add(v)}
                  >
                    <span className="tnum">{v >= 1 ? v : 50}</span>
                    <small>{v >= 1 ? "€" : "ct"}</small>
                  </button>
                ))}
              </div>
              <button
                className={styles.denomReset}
                aria-label="Erhaltenen Betrag zurücksetzen"
                disabled={nothingGiven}
                onClick={() => setReceived(0)}
              >
                <ArrowUUpLeft size={18} />
              </button>
            </div>
          </>
        )}

        {!padOpen && (
          <>
        <div
          className={`${styles.changeBox} ${!nothingGiven && !enough ? styles.changeShort : ""}`}
          aria-live="polite"
        >
          {nothingGiven ? (
            <span className={styles.changeIdle}>
              Passend erhalten? Direkt abschließen. Sonst antippen, was der Gast
              hinlegt.
            </span>
          ) : (
            <>
              <div className={styles.changeInfo}>
                <span className={styles.changeGot}>
                  Erhalten <b className="tnum">{euro(received)}</b>
                </span>
                <span className={styles.changeLabel}>
                  {enough ? "Rückgeld" : "Es fehlen noch"}
                </span>
              </div>
              <span className={`${styles.changeValue} tnum`}>
                {euro(Math.abs(change))}
              </span>
            </>
          )}
        </div>

        <button
          className={styles.confirmBtn}
          disabled={busy}
          onClick={() => onConfirm({ tip: 0 })}
        >
          <CheckCircle size={22} weight="fill" />
          {busy
            ? "Wird verarbeitet …"
            : nothingGiven
              ? "Passend erhalten · abschließen"
              : `Abschließen · ${euro(Math.max(0, change))} zurück`}
        </button>

        {!busy && enough && change > 0.005 && (
          <button
            className={styles.secondaryBtn}
            onClick={() => onConfirm({ tip: change })}
          >
            <HandCoins size={20} />
            Stimmt so · {euro(change)} Trinkgeld
          </button>
        )}

        <button className={styles.backBtn} onClick={onBack} disabled={busy}>
          Zurück zur Bestellung
        </button>
          </>
        )}
      </div>
    </div>
  );
}
