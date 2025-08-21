import { useContext, useEffect, useState, useCallback } from "react";
import { ProductContext } from "../context/ProductContext";
import CategoryCard from "../components/cards/CategoryCard.component";
import CategoryEditModal from "../components/modals/CategoryEditModal.component";
import CardWrapper from "../components/cards/CardWrapper.component";
import AddCard from "../components/cards/AddCard.component";
import CategoryGrid from "../components/cards/CategoryGrid.component";

const EMPTY_CATEGORY = { id: -1, name: "", icon: "MdCategory" };

interface Category {
  id: number;
  name: string;
  icon: string;
}

export default function CategoryCardFeature() {
  const ctx = useContext(ProductContext);
  const [localCategories, setLocalCategories] = useState(ctx?.categories ?? []);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isNewCategory, setIsNewCategory] = useState(false);
  const [draggedCategory, setDraggedCategory] = useState<Category | null>(null);

  // All hooks must be before early returns!
  useEffect(() => {
    if (ctx) setLocalCategories(ctx.categories);
  }, [ctx, ctx?.categories]);

  // Handle Add New Category
  const handleAddNew = useCallback(() => {
    setEditingCategory({ ...EMPTY_CATEGORY });
    setIsNewCategory(true);
    setIsModalOpen(true);
  }, []);

  // Handle Edit Category
  const handleEditCategory = useCallback((category: Category) => {
    setEditingCategory(category);
    setIsNewCategory(false);
    setIsModalOpen(true);
  }, []);

  // Handle Modal Close
  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    setEditingCategory(null);
    setIsNewCategory(false);
  }, []);

  // Handle Modal Save
  const handleModalSave = useCallback(
    async (updatedCategory: Category) => {
      if (!ctx) return;

      if (isNewCategory) {
        // Optimistic Add
        setLocalCategories((prev) => [
          ...prev,
          { ...updatedCategory, id: Math.max(0, ...prev.map((c) => c.id)) + 1 },
        ]);
        await ctx.addCategory(updatedCategory);
      } else {
        // Optimistic Edit
        setLocalCategories((prev) =>
          prev.map((c) => (c.id === updatedCategory.id ? updatedCategory : c))
        );
        await ctx.updateCategory(updatedCategory);
      }

      // Close modal after successful save
      setIsModalOpen(false);
      setEditingCategory(null);
      setIsNewCategory(false);
    },
    [ctx, isNewCategory]
  );

  // Handle Delete
  const handleDelete = useCallback(
    async (id: number) => {
      if (!ctx) return;

      // Optimistic Delete
      setLocalCategories((prev) => prev.filter((c) => c.id !== id));
      await ctx.deleteCategory(id);
    },
    [ctx]
  );

  // Handle Drag Start
  const handleDragStart = useCallback((category: Category) => {
    setDraggedCategory(category);
  }, []);

  // Handle Drag End
  const handleDragEnd = useCallback(() => {
    setDraggedCategory(null);
  }, []);

  // Handle Category Reorder
  const handleCategoryReorder = useCallback(
    async (newOrder: number[]) => {
      if (!ctx) return;

      // Optimistic reorder
      const reorderedCategories = newOrder
        .map((id) => localCategories.find((cat) => cat.id === id))
        .filter(Boolean) as Category[];

      setLocalCategories(reorderedCategories);

      // Here you could call a reorder API if available
      // await ctx.reorderCategories(newOrder);
    },
    [ctx, localCategories]
  );

  // Early return after all hooks
  if (!ctx) return null;

  // Build cards array
  const cards = [
    // Category cards
    ...localCategories.map((category) => (
      <CardWrapper
        key={category.id}
        isEditing={false}
        editLocked={false}
        onRequestEdit={() => handleEditCategory(category)}
        onRequestView={undefined}
        onSaveAction={undefined}
        onDeleteAction={handleDelete}
        item={category}
        itemId={category.id}
      >
        {() => (
          <CategoryCard
            id={category.id}
            name={category.name}
            icon={category.icon}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            isDragging={draggedCategory?.id === category.id}
          />
        )}
      </CardWrapper>
    )),
    // Add card
    <CardWrapper
      key="add-card"
      isEditing={false}
      editLocked={false}
      onRequestEdit={undefined}
      onRequestView={undefined}
      onSaveAction={undefined}
      onDeleteAction={undefined}
      item={null}
      itemId={-999}
    >
      {() => <AddCard onAdd={handleAddNew} />}
    </CardWrapper>,
  ];

  return (
    <>
      <CategoryGrid cards={cards} onReorder={handleCategoryReorder} />

      {/* Edit Modal */}
      <CategoryEditModal
        isOpen={isModalOpen}
        category={editingCategory}
        isNewCategory={isNewCategory}
        onSave={handleModalSave}
        onClose={handleModalClose}
      />
    </>
  );
}
