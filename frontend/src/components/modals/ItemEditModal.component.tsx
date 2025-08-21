import { useState, useEffect } from "react";
import { MdSave, MdAdd, MdDelete } from "react-icons/md";
import { Item, ItemVariant } from "../../context/ProductContext";
import BaseModal from "./BaseModal.component";

type ItemEditModalProps = {
  isOpen: boolean;
  item: Item | null;
  isNewItem?: boolean;
  onSave: (updatedItem: Item) => void;
  onClose: () => void;
};

export default function ItemEditModal({
  isOpen,
  item,
  isNewItem = false,
  onSave,
  onClose,
}: ItemEditModalProps) {
  const [editedItem, setEditedItem] = useState<Item | null>(null);

  // Update editedItem when item prop changes
  useEffect(() => {
    setEditedItem(item);
  }, [item]);

  if (!isOpen || !item || !editedItem) return null;

  const handleNameChange = (value: string) => {
    setEditedItem({ ...editedItem, name: value });
  };

  const handleDepositAmountChange = (value: string) => {
    const depositAmount = parseFloat(value) || 0;
    setEditedItem({ ...editedItem, deposit_amount: depositAmount });
  };

  const handleVariantChange = (
    index: number,
    field: keyof ItemVariant,
    value: string | number
  ) => {
    const updatedVariants = [...editedItem.item_variants];
    updatedVariants[index] = { ...updatedVariants[index], [field]: value };
    setEditedItem({ ...editedItem, item_variants: updatedVariants });
  };

  const addVariant = () => {
    const newVariant: ItemVariant = {
      id: -1,
      name: "",
      price: 0,
      bill_steps: 1,
      stock_item_od: editedItem.id,
    };
    setEditedItem({
      ...editedItem,
      item_variants: [...editedItem.item_variants, newVariant],
    });
  };

  const removeVariant = (index: number) => {
    const updatedVariants = editedItem.item_variants.filter(
      (_, i) => i !== index
    );
    setEditedItem({ ...editedItem, item_variants: updatedVariants });
  };

  const handleSave = () => {
    onSave(editedItem);
    // Don't close here - let the parent handle it
  };

  const handleClose = () => {
    setEditedItem(item); // Reset changes
    onClose();
  };

  // Check if this is a simple item (single variant without name)
  const isSimpleItem =
    editedItem.item_variants.length === 1 && !editedItem.item_variants[0].name;

  const simpleVariant = editedItem.item_variants[0];

  const handleSimplePriceChange = (price: number) => {
    const updatedVariants = [{ ...simpleVariant, price }];
    setEditedItem({ ...editedItem, item_variants: updatedVariants });
  };

  const handleSimpleStepsChange = (bill_steps: number) => {
    const updatedVariants = [{ ...simpleVariant, bill_steps }];
    setEditedItem({ ...editedItem, item_variants: updatedVariants });
  };

  const switchToVariantMode = () => {
    const newVariants: ItemVariant[] = [
      { ...simpleVariant, name: "Standard" },
      {
        id: -1,
        name: "",
        price: 0,
        bill_steps: 1,
        stock_item_od: editedItem.id,
      },
    ];
    setEditedItem({ ...editedItem, item_variants: newVariants });
  };

  const switchToSimpleMode = () => {
    if (editedItem.item_variants.length > 0) {
      const firstVariant = editedItem.item_variants[0];
      const simpleVariant: ItemVariant = {
        ...firstVariant,
        name: "",
      };
      setEditedItem({ ...editedItem, item_variants: [simpleVariant] });
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={handleClose}
      title={isNewItem ? "Neuen Artikel erstellen" : "Artikel bearbeiten"}
      inputContent={
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--spacing-lg)",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--spacing-sm)",
            }}
          >
            <label
              style={{
                fontWeight: "var(--font-weight-medium)",
                color: "var(--text-primary)",
              }}
            >
              Artikelname
            </label>
            <input
              type="text"
              value={editedItem.name}
              placeholder="Name eingeben..."
              onChange={(e) => handleNameChange(e.target.value)}
              style={{
                padding: "var(--spacing-md)",
                border: "1px solid var(--card-border)",
                borderRadius: "var(--radius-md)",
                fontSize: "var(--fs-200)",
                backgroundColor: "var(--card-background)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          {/* Deposit Amount */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--spacing-sm)",
            }}
          >
            <label
              style={{
                fontWeight: "var(--font-weight-medium)",
                color: "var(--text-primary)",
              }}
            >
              Pfandbetrag (€)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={editedItem.deposit_amount || 0}
              placeholder="0.00"
              onChange={(e) => handleDepositAmountChange(e.target.value)}
              style={{
                padding: "var(--spacing-md)",
                border: "1px solid var(--card-border)",
                borderRadius: "var(--radius-md)",
                fontSize: "var(--fs-200)",
                backgroundColor: "var(--card-background)",
                color: "var(--text-primary)",
              }}
            />
            <small
              style={{
                color: "var(--text-secondary)",
                fontSize: "var(--fs-100)",
              }}
            >
              Pfandbetrag pro Artikel (0 = kein Pfand)
            </small>
          </div>

          {/* Simple Mode: Just Price and Steps */}
          {isSimpleItem ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--spacing-lg)",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "var(--spacing-md)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--spacing-sm)",
                  }}
                >
                  <label
                    style={{
                      fontWeight: "var(--font-weight-medium)",
                      color: "var(--text-primary)",
                    }}
                  >
                    Preis
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={simpleVariant.price.toString()}
                    placeholder="0.00"
                    onChange={(e) =>
                      handleSimplePriceChange(parseFloat(e.target.value) || 0)
                    }
                    style={{
                      padding: "var(--spacing-md)",
                      border: "1px solid var(--card-border)",
                      borderRadius: "var(--radius-md)",
                      fontSize: "var(--fs-200)",
                      backgroundColor: "var(--card-background)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--spacing-sm)",
                  }}
                >
                  <label
                    style={{
                      fontWeight: "var(--font-weight-medium)",
                      color: "var(--text-primary)",
                    }}
                  >
                    Schrittweite
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={simpleVariant.bill_steps.toString()}
                    placeholder="1"
                    onChange={(e) =>
                      handleSimpleStepsChange(
                        e.target.value === "" ? 0 : parseFloat(e.target.value)
                      )
                    }
                    style={{
                      padding: "var(--spacing-md)",
                      border: "1px solid var(--card-border)",
                      borderRadius: "var(--radius-md)",
                      fontSize: "var(--fs-200)",
                      backgroundColor: "var(--card-background)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={switchToVariantMode}
                className="secondaryButton"
                style={{
                  padding: "var(--spacing-md) var(--spacing-lg)",
                  border: "1px solid var(--card-border)",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "transparent",
                  color: "var(--text-primary)",
                  cursor: "pointer",
                  alignSelf: "flex-start",
                }}
              >
                Mit Varianten arbeiten
              </button>
            </div>
          ) : (
            /* Variant Mode: Full Variant Management */
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--spacing-lg)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <h4 style={{ margin: 0, color: "var(--text-primary)" }}>
                  Varianten
                </h4>
                <div style={{ display: "flex", gap: "var(--spacing-md)" }}>
                  <button
                    type="button"
                    onClick={addVariant}
                    style={{
                      padding: "var(--spacing-sm) var(--spacing-md)",
                      border: "1px solid var(--color-accent)",
                      borderRadius: "var(--radius-md)",
                      backgroundColor: "var(--color-accent)",
                      color: "var(--color-navy)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--spacing-sm)",
                      fontSize: "var(--fs-100)",
                    }}
                  >
                    <MdAdd size={16} />
                    Hinzufügen
                  </button>
                  {(editedItem.item_variants.length > 1 ||
                    (editedItem.item_variants.length === 1 &&
                      editedItem.item_variants[0].name)) && (
                    <button
                      type="button"
                      onClick={switchToSimpleMode}
                      className="secondaryButton"
                      style={{
                        padding: "var(--spacing-sm) var(--spacing-md)",
                        border: "1px solid var(--card-border)",
                        borderRadius: "var(--radius-md)",
                        backgroundColor: "transparent",
                        color: "var(--text-primary)",
                        cursor: "pointer",
                        fontSize: "var(--fs-100)",
                      }}
                    >
                      Vereinfachen
                    </button>
                  )}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--spacing-md)",
                }}
              >
                {editedItem.item_variants.map((variant, index) => (
                  <div
                    key={index}
                    style={{
                      padding: "var(--spacing-lg)",
                      border: "1px solid var(--card-border)",
                      borderRadius: "var(--radius-md)",
                      backgroundColor: "var(--color-surface)",
                      position: "relative",
                    }}
                  >
                    {editedItem.item_variants.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeVariant(index)}
                        title="Variante entfernen"
                        style={{
                          position: "absolute",
                          top: "var(--spacing-sm)",
                          right: "var(--spacing-sm)",
                          background: "var(--color-error)",
                          border: "none",
                          borderRadius: "50%",
                          width: "32px",
                          height: "32px",
                          color: "white",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <MdDelete size={16} />
                      </button>
                    )}

                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "var(--spacing-md)",
                        marginRight:
                          editedItem.item_variants.length > 1 ? "40px" : "0",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "var(--spacing-sm)",
                        }}
                      >
                        <label
                          style={{
                            fontWeight: "var(--font-weight-medium)",
                            color: "var(--text-primary)",
                          }}
                        >
                          Varianten-Name
                        </label>
                        <input
                          type="text"
                          value={variant.name}
                          placeholder={`Variante ${index + 1}`}
                          onChange={(e) =>
                            handleVariantChange(index, "name", e.target.value)
                          }
                          style={{
                            padding: "var(--spacing-md)",
                            border: "1px solid var(--card-border)",
                            borderRadius: "var(--radius-md)",
                            fontSize: "var(--fs-200)",
                            backgroundColor: "var(--card-background)",
                            color: "var(--text-primary)",
                          }}
                        />
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: "var(--spacing-md)",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "var(--spacing-sm)",
                          }}
                        >
                          <label
                            style={{
                              fontWeight: "var(--font-weight-medium)",
                              color: "var(--text-primary)",
                            }}
                          >
                            Preis
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={variant.price.toString()}
                            placeholder="0.00"
                            onChange={(e) =>
                              handleVariantChange(
                                index,
                                "price",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            style={{
                              padding: "var(--spacing-md)",
                              border: "1px solid var(--card-border)",
                              borderRadius: "var(--radius-md)",
                              fontSize: "var(--fs-200)",
                              backgroundColor: "var(--card-background)",
                              color: "var(--text-primary)",
                            }}
                          />
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "var(--spacing-sm)",
                          }}
                        >
                          <label
                            style={{
                              fontWeight: "var(--font-weight-medium)",
                              color: "var(--text-primary)",
                            }}
                          >
                            Schrittweite
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={variant.bill_steps.toString()}
                            placeholder="1"
                            onChange={(e) =>
                              handleVariantChange(
                                index,
                                "bill_steps",
                                e.target.value === ""
                                  ? 0
                                  : parseFloat(e.target.value)
                              )
                            }
                            style={{
                              padding: "var(--spacing-md)",
                              border: "1px solid var(--card-border)",
                              borderRadius: "var(--radius-md)",
                              fontSize: "var(--fs-200)",
                              backgroundColor: "var(--card-background)",
                              color: "var(--text-primary)",
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      }
      commandContent={
        <button
          type="submit"
          onClick={handleSave}
          className="primaryButton"
          style={{
            padding: "var(--spacing-md) var(--spacing-lg)",
            backgroundColor: "var(--color-accent)",
            color: "var(--color-navy)",
            border: "1px solid var(--color-accent)",
            borderRadius: "var(--radius-md)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "var(--spacing-sm)",
            fontWeight: "var(--font-weight-medium)",
          }}
        >
          <MdSave size={18} />
          Speichern
        </button>
      }
    />
  );
}
