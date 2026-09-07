import { useEffect, useMemo, useReducer, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUUpLeft,
  Basket,
  CaretUp,
  CheckCircle,
  Minus,
  GearSix,
  Money,
  Plus,
  ReceiptX,
  Trash,
  X,
} from "@phosphor-icons/react";
import { api } from "../api/client";
import { Topbar } from "../components/Topbar";
import topbar from "../components/Topbar.module.css";
import type { StockItem, Variant } from "../api/types";
import { euro, toNumber } from "../lib/money";
import {
  cartReducer,
  cartTotals,
  emptyCart,
  type CartLine,
} from "../order/cartReducer";
import { catIcon } from "../order/catIcon";
import { useLongPress } from "../order/useLongPress";
import { useOrderData } from "../order/useOrderData";
import styles from "./OrderTerminal.module.css";

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
  const { loading, event, categories, items, reload } = useOrderData();
  const [cart, dispatch] = useReducer(cartReducer, emptyCart);
  const [catId, setCatId] = useState<number | null>(null);
  const [openItemId, setOpenItemId] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [depPrice, setDepPrice] = useState(
    () => localStorage.getItem("hz_deposit_price") || "2.00",
  );

  useEffect(() => {
    if (catId == null && categories.length) setCatId(categories[0].id);
  }, [categories, catId]);

  useEffect(() => {
    try {
      localStorage.setItem("hz_deposit_price", depPrice);
    } catch {
      /* ignore */
    }
  }, [depPrice]);

  const totals = cartTotals(cart);
  const currentCat = categories.find((c) => c.id === catId) ?? null;
  const catItems = useMemo(
    () => items.filter((i) => i.category_id === catId),
    [items, catId],
  );

  async function bumpLine(line: Omit<CartLine, "qty">, step: number) {
    dispatch({ type: "bump", line, step });
    try {
      const ao = await api.lineDelta(line.variantId, step);
      dispatch({
        type: "syncLines",
        lines: ao.lines.map((l) => ({
          variantId: l.item_variant_id,
          qty: toNumber(l.quantity),
        })),
      });
    } catch {
      /* Server-Reconcile scheitert leise; lokaler Stand bleibt */
    }
  }

  const bump = (item: StockItem, variant: Variant, step: number) =>
    bumpLine(lineFrom(item, variant), step);

  function undo() {
    if (cart.lastVariantId == null) return;
    const l = cart.lines.find((x) => x.variantId === cart.lastVariantId);
    if (l) bumpLine(l, -1);
  }

  function setDeposit(quantity: number) {
    const unit = parseFloat(depPrice) || 0;
    dispatch({ type: "setDepositReturn", unitAmount: unit, quantity });
    api.setDepositReturn(unit, Math.max(0, quantity)).catch(() => undefined);
  }

  async function pay() {
    if (busy || totals.count === 0) return;
    setBusy(true);
    try {
      await api.createBill();
      dispatch({ type: "clear" });
      setPayOpen(false);
      setSheetOpen(false);
    } catch {
      alert("Bon konnte nicht erstellt werden. Bitte erneut versuchen.");
    } finally {
      setBusy(false);
    }
  }

  const lastLine = cart.lines.find((l) => l.variantId === cart.lastVariantId);

  if (!loading && !event) {
    return (
      <div className={`${styles.screen} no-select`}>
        <Topbar>
          <TopNav />
        </Topbar>
        <div className={styles.notice}>
          <h1>Keine aktive Veranstaltung</h1>
          <p>
            Im Verwaltungsbereich eine Veranstaltung anlegen und aktivieren, dann
            erscheint hier der Katalog.
          </p>
          <button className={styles.ghost} onClick={reload}>
            Neu laden
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.screen} no-select`}>
      <Topbar>
        <TopNav />
      </Topbar>

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
          disabled={cart.lastVariantId == null}
        >
          <ArrowUUpLeft size={22} />
        </button>
        <button
          className={styles.cartBtn}
          onClick={() => setSheetOpen(true)}
          disabled={totals.count === 0}
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
        >
          <Money size={22} weight="fill" />
          Bar kassieren
        </button>
      </div>

      {sheetOpen && (
        <CartSheet
          cart={cart}
          totals={totals}
          depPrice={depPrice}
          onDepPrice={setDepPrice}
          onClose={() => setSheetOpen(false)}
          onClear={() => dispatch({ type: "clear" })}
          onBumpLine={bumpLine}
          onDeposit={setDeposit}
          onPay={() => setPayOpen(true)}
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
    </div>
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
    <div className={`${styles.card} ${qty > 0 ? styles.has : ""}`}>
      <button className={styles.cardBtn} {...press}>
        <span className={styles.name}>{item.name}</span>
        <span className={styles.price}>
          <b>{euro(variant.price)}</b>
          {variant.name && <small>{variant.name}</small>}
        </span>
        {deposit > 0 && (
          <span className={styles.dep}>+ {euro(deposit)} Pfand</span>
        )}
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
      className={`${styles.card} ${total > 0 ? styles.has : ""} ${open ? styles.open : ""}`}
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

function CartSheet({
  cart,
  totals,
  depPrice,
  onDepPrice,
  onClose,
  onClear,
  onBumpLine,
  onDeposit,
  onPay,
}: {
  cart: import("../order/cartReducer").CartState;
  totals: import("../order/cartReducer").CartTotals;
  depPrice: string;
  onDepPrice: (v: string) => void;
  onClose: () => void;
  onClear: () => void;
  onBumpLine: (line: CartLine, step: number) => void;
  onDeposit: (quantity: number) => void;
  onPay: () => void;
}) {
  const depQty = cart.depositReturn?.quantity ?? 0;
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.sheetHead}>
          <h2>Warenkorb</h2>
          <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
            {totals.count} Artikel · antippen zum Korrigieren
          </span>
          <span className={styles.grow} />
          <button className={`${styles.ghost} ${styles.danger}`} onClick={onClear}>
            <Trash size={16} />
            Leeren
          </button>
          <button className={styles.ghost} onClick={onClose}>
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
                <button
                  className={styles.step}
                  onClick={() => onBumpLine(l, -1)}
                  aria-label="weniger"
                >
                  <Minus size={15} />
                </button>
                <span className={`${styles.count} tnum`}>{l.qty}</span>
                <button
                  className={styles.step}
                  onClick={() => onBumpLine(l, 1)}
                  aria-label="mehr"
                >
                  <Plus size={15} />
                </button>
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
            onClick={() => onDeposit(depQty + 1)}
          >
            {depQty > 0 ? `${depQty} Pfand zurück` : "Pfand zurück"}
          </button>
          <input
            className={`${styles.priceField} tnum`}
            type="number"
            step="0.01"
            min="0"
            value={depPrice}
            onChange={(e) => onDepPrice(e.target.value)}
            aria-label="Pfandbetrag je Stück"
          />
          {depQty > 0 && (
            <button className={styles.ghost} onClick={() => onDeposit(0)}>
              <X size={14} />
            </button>
          )}
          <span className={`${styles.sheetTotal} tnum`}>{euro(totals.due)}</span>
          <button className={styles.payBtn} onClick={onPay}>
            <Money size={22} weight="fill" />
            Bar kassieren
          </button>
        </div>
      </div>
    </div>
  );
}

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
  onConfirm: () => void;
  onBack: () => void;
}) {
  const scheine = [10, 20, 50];
  return (
    <div className={`${styles.overlay} ${styles.overlayCenter}`}>
      <div className={styles.payCard}>
        <div className={styles.payHead}>
          <h2>Bar kassieren</h2>
          <span style={{ color: "var(--text-muted)", fontSize: 12.5 }}>
            {count} Artikel
          </span>
        </div>
        <div className={`${styles.payBig} tnum`}>
          {euro(due)}
          <small>inkl. Pfand</small>
        </div>
        <div className={styles.changeGrid}>
          {scheine.map((s) => (
            <button
              key={s}
              className={styles.changeBtn}
              disabled={s < due || busy}
              onClick={onConfirm}
            >
              <b className="tnum">{euro(s)}</b>
              <small className="tnum">Rückgeld {euro(Math.max(0, s - due))}</small>
            </button>
          ))}
        </div>
        <button className={styles.confirmBtn} disabled={busy} onClick={onConfirm}>
          <CheckCircle size={22} weight="fill" />
          {busy ? "Wird verarbeitet…" : "Passend erhalten · abschließen"}
        </button>
        <button className={styles.backBtn} onClick={onBack} disabled={busy}>
          Zurück zur Bestellung
        </button>
      </div>
    </div>
  );
}
