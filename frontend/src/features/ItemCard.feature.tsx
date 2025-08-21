import { useState, useEffect, useCallback, useContext } from "react";
import { ProductContext, Item } from "../context/ProductContext";
import CompactItemCard from "../components/cards/CompactItemCard.component";
import CompactAddCard from "../components/cards/CompactAddCard.component";
import ItemEditModal from "../components/modals/ItemEditModal.component";
import CategoryDragLayout from "../layouts/CategoryDragLayout.layout";
import DraggableCompactListLayout from "../layouts/DraggableCompactList.layout";

export default function ItemCardFeature() {
  const ctx = useContext(ProductContext);
  const [localItems, setLocalItems] = useState<Item[]>([]);
  const [draggedItem, setDraggedItem] = useState<Item | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(
    null
  );
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNewItem, setIsNewItem] = useState(false);

  // Alle Hooks müssen vor dem early return stehen!
  const handleDragStart = useCallback((item: Item) => {
    setDraggedItem(item);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedItem(null);
  }, []);

  const handleItemEdit = useCallback((item: Item) => {
    setEditingItem(item);
    setIsNewItem(false);
    setIsModalOpen(true);
  }, []);

  const handleItemAdd = useCallback(() => {
    const newItem: Item = {
      id: -1,
      name: "",
      category_id: selectedCategoryId || 1,
      item_variants: [
        {
          id: -1,
          name: "",
          price: 0,
          bill_steps: 1,
          stock_item_od: -1,
        },
      ],
    };
    setEditingItem(newItem);
    setIsNewItem(true);
    setIsModalOpen(true);
  }, [selectedCategoryId]);

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    setEditingItem(null);
    setIsNewItem(false);
  }, []);

  const handleModalSave = useCallback(
    async (updatedItem: Item) => {
      if (!ctx) return;

      if (isNewItem) {
        // For new items, add to context
        const itemWithCategory = {
          ...updatedItem,
          category_id: selectedCategoryId || 1,
        };
        await ctx.addItem(itemWithCategory);
      } else {
        // For existing items, update
        setLocalItems((prev) =>
          prev.map((item) => (item.id === updatedItem.id ? updatedItem : item))
        );
        await ctx.updateItem(updatedItem);
      }

      // Close modal after successful save
      setIsModalOpen(false);
      setEditingItem(null);
      setIsNewItem(false);
    },
    [ctx, isNewItem, selectedCategoryId]
  );

  const handleCategoryDrop = useCallback(
    async (categoryId: number) => {
      if (!draggedItem || !ctx) return;

      const updatedItem = { ...draggedItem, category_id: categoryId };
      setLocalItems((prev) =>
        prev.map((item) => (item.id === draggedItem.id ? updatedItem : item))
      );
      await ctx.updateItem(updatedItem);
      setDraggedItem(null);
    },
    [draggedItem, ctx]
  );

  const handleItemReorder = useCallback(
    async (categoryId: number, reorderedItems: Item[]) => {
      if (!ctx) return;

      // Update local state immediately
      setLocalItems((prev) => {
        const itemsInOtherCategories = prev.filter(
          (item) => item.category_id !== categoryId
        );
        return [...itemsInOtherCategories, ...reorderedItems];
      });

      // Send order to backend
      const itemIds = reorderedItems.map((item) => item.id);
      await ctx.updateItemSorting(itemIds);
    },
    [ctx]
  );

  const handleDelete = useCallback(
    async (id: number) => {
      if (!ctx) return;
      setLocalItems((prev) => prev.filter((item) => item.id !== id));
      await ctx.deleteItem(id);
    },
    [ctx]
  );

  useEffect(() => {
    if (ctx) {
      setLocalItems(ctx.items);
      // Auto-select first category if none selected
      if (!selectedCategoryId && ctx.categories.length > 0) {
        setSelectedCategoryId(ctx.categories[0].id);
      }
    }
  }, [ctx, ctx?.items, ctx?.categories, selectedCategoryId]);

  if (!ctx) return null;

  const { categories } = ctx;

  // Filter items by selected category
  const filteredItems = selectedCategoryId
    ? localItems.filter((item) => item.category_id === selectedCategoryId)
    : [];

  return (
    <div>
      {/* Category Selection Header */}
      <CategoryDragLayout
        categories={categories}
        items={localItems}
        selectedCategoryId={selectedCategoryId}
        onCategorySelect={setSelectedCategoryId}
        onCategoryDrop={handleCategoryDrop}
        onItemReorder={handleItemReorder}
        draggedItem={draggedItem}
      />

      {/* Items for Selected Category */}
      {selectedCategoryId && (
        <div style={{ marginTop: "24px" }}>
          <DraggableCompactListLayout
            items={filteredItems}
            addCard={<CompactAddCard onAdd={handleItemAdd} />}
            CompactCardComponent={CompactItemCard}
            onEdit={handleItemEdit}
            onDelete={handleDelete}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onItemReorder={handleItemReorder}
            draggedItem={draggedItem}
            selectedCategoryId={selectedCategoryId}
          />
        </div>
      )}

      {/* Edit Modal */}
      <ItemEditModal
        isOpen={isModalOpen}
        item={editingItem}
        isNewItem={isNewItem}
        onSave={handleModalSave}
        onClose={handleModalClose}
      />
    </div>
  );
}
