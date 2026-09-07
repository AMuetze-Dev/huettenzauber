import { useState } from "react";
import CardWrapper from "./CardWrapper.component";
import AddCard from "./AddCard.component";

type CardManagerProps<T> = {
  items: T[];
  CardComponent: React.ComponentType<any>;
  emptyItem: T;
  onAdd: (item: T) => Promise<void> | void;
  onEdit: (item: T) => Promise<void> | void;
  onDelete: (id: number) => Promise<void> | void;
  customAddHandler?: () => void; // New prop for custom add behavior
  Layout: React.ComponentType<{
    cards: React.ReactNode[];
    addCard?: React.ReactNode;
  }>;
};

export default function CardManager<T extends { id: number }>({
  items,
  CardComponent,
  emptyItem,
  onAdd,
  onEdit,
  onDelete,
  customAddHandler,
  Layout,
}: CardManagerProps<T>) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [addMode, setAddMode] = useState(false);
  const [editingItems, setEditingItems] = useState<{ [key: string]: T }>({});

  const handleSave = async (item: T) => {
    if (item.id === -1) {
      await onAdd(item);
      setAddMode(false);
    } else {
      await onEdit(item);
      setEditingId(null);
    }
    // Clear editing state
    setEditingItems((prev) => {
      const newState = { ...prev };
      delete newState[item.id.toString()];
      return newState;
    });
  };

  const handleDelete = async (id: number) => {
    await onDelete(id);
    setEditingId(null);
    setEditingItems((prev) => {
      const newState = { ...prev };
      delete newState[id.toString()];
      return newState;
    });
  };

  const handleEditStart = (item: T) => {
    setEditingId(item.id);
    setEditingItems((prev) => ({
      ...prev,
      [item.id.toString()]: { ...item },
    }));
  };

  const handleEditCancel = (itemId: number) => {
    setEditingId(null);
    setEditingItems((prev) => {
      const newState = { ...prev };
      delete newState[itemId.toString()];
      return newState;
    });
  };

  const handleEditChange = (itemId: number, updatedItem: T) => {
    setEditingItems((prev) => ({
      ...prev,
      [itemId.toString()]: updatedItem,
    }));
  };

  const cards = items.map((item) => {
    const isEditing = editingId === item.id;
    const currentItem =
      isEditing && editingItems[item.id.toString()]
        ? editingItems[item.id.toString()]
        : item;

    return (
      <CardWrapper
        key={item.id}
        isEditing={isEditing}
        editLocked={(editingId !== null && editingId !== item.id) || addMode}
        onRequestEdit={() => handleEditStart(item)}
        onRequestView={() => handleEditCancel(item.id)}
        onSaveAction={() => handleSave(currentItem)}
        onDeleteAction={handleDelete}
        item={currentItem}
        itemId={item.id}
      >
        {(mode) => (
          <CardComponent
            {...currentItem}
            mode={mode}
            onChange={
              isEditing
                ? (updatedItem: T) => handleEditChange(item.id, updatedItem)
                : undefined
            }
          />
        )}
      </CardWrapper>
    );
  });

  const addCard =
    !addMode && editingId === null ? (
      <CardWrapper
        key="add-card"
        isEditing={false}
        editLocked={false}
        onRequestEdit={undefined} // AddCard kann nicht bearbeitet werden
        onRequestView={undefined}
        onSaveAction={undefined}
        onDeleteAction={undefined} // AddCard kann nicht gelöscht werden
        item={null}
        itemId={-999} // Spezielle ID für AddCard
      >
        {() => (
          <AddCard
            onAdd={
              customAddHandler ||
              (() => {
                setAddMode(true);
                setEditingItems((prev) => ({
                  ...prev,
                  new: { ...emptyItem, id: -1 },
                }));
              })
            }
          />
        )}
      </CardWrapper>
    ) : null;

  const newCard = addMode ? (
    <CardWrapper
      key="new"
      isEditing={true}
      onRequestView={() => {
        setAddMode(false);
        setEditingItems((prev) => {
          const newState = { ...prev };
          delete newState["new"];
          return newState;
        });
      }}
      onSaveAction={() => {
        const newItem = editingItems["new"] || { ...emptyItem, id: -1 };
        handleSave(newItem);
      }}
      item={editingItems["new"] || { ...emptyItem, id: -1 }}
      itemId={-1}
    >
      {(mode) => (
        <CardComponent
          {...(editingItems["new"] || { ...emptyItem, id: -1 })}
          mode={mode}
          onChange={(updatedItem: T) => {
            setEditingItems((prev) => ({
              ...prev,
              new: updatedItem,
            }));
          }}
        />
      )}
    </CardWrapper>
  ) : null;

  return <Layout cards={[...cards, addCard, newCard].filter(Boolean)} />;
}
