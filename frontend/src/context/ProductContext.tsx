import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { api } from '../assets/constants';

export interface Category {
	id: number;
	name: string;
	icon: string;
}
export interface ItemVariant {
	id: number;
	name: string;
	price: number;
	bill_steps: number;
	stock_item_od: number;
}
export interface Item {
	id: number;
	name: string;
	category_id: number;
	deposit_amount?: number;
	item_variants: ItemVariant[];
}

interface ProductContextType {
	categories: Category[];
	items: Item[];
	reloadAll: () => Promise<void>;
	addCategory: (cat: Partial<Category>) => Promise<void>;
	updateCategory: (cat: Category) => Promise<void>;
	deleteCategory: (id: number) => Promise<void>;
	addItem: (item: Partial<Item>) => Promise<void>;
	updateItem: (item: Item) => Promise<void>;
	deleteItem: (id: number) => Promise<void>;
	addItemVariant: (variant: Partial<ItemVariant>) => Promise<void>;
	updateItemVariant: (variant: ItemVariant) => Promise<void>;
	deleteItemVariant: (id: number) => Promise<void>;
	updateCategorySorting: (orderedCategoryIds: number[]) => Promise<void>;
	updateItemSorting: (orderedItemIds: number[]) => Promise<void>;
}

export const ProductContext = createContext<ProductContextType | undefined>(undefined);

export const ProductProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const [categories, setCategories] = useState<Category[]>([]);
	const [items, setItems] = useState<Item[]>([]);

	const reloadCategories = useCallback(async () => {
		const res = await fetch(`${api}/categories/`);
		if (!res.ok) {
			toast.error(await res.text());
			throw new Error('Fehler beim Laden der Kategorien');
		}
		setCategories(await res.json());
	}, []);

	const reloadItems = useCallback(async () => {
		const res = await fetch(`${api}/stock-items/`);
		if (!res.ok) {
			toast.error(await res.text());
			throw new Error('Fehler beim Laden der Artikel');
		}
		setItems(await res.json());
	}, []);

	const reloadAll = useCallback(async () => {
		await reloadCategories();
		await reloadItems();
	}, [reloadCategories, reloadItems]);

	const addCategory = useCallback(
		async (cat: Partial<Category>) => {
			const res = await fetch(`${api}/categories/`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(cat),
			});
			res.ok ? await reloadCategories() : toast.error(await res.text());
		},
		[reloadCategories]
	);

	const updateCategory = useCallback(
		async (cat: Category) => {
			const res = await fetch(`${api}/categories/${cat.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(cat),
			});
			res.ok ? await reloadCategories() : toast.error(await res.text());
		},
		[reloadCategories]
	);

	const deleteCategory = useCallback(
		async (id: number) => {
			const res = await fetch(`${api}/categories/${id}`, {
				method: 'DELETE',
			});
			res.ok ? await reloadCategories() : toast.error(await res.text());
		},
		[reloadCategories]
	);

	const addItem = useCallback(
		async (item: Partial<Item>) => {
			const res = await fetch(`${api}/stock-items/`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(item),
			});
			res.ok ? await reloadItems() : toast.error(await res.text());
		},
		[reloadItems]
	);

	const updateItem = useCallback(
		async (item: Item) => {
			const res = await fetch(`${api}/stock-items/${item.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(item),
			});
			res.ok ? await reloadItems() : toast.error(await res.text());
		},
		[reloadItems]
	);

	const deleteItem = useCallback(
		async (id: number) => {
			const res = await fetch(`${api}/stock-items/${id}`, {
				method: 'DELETE',
			});
			res.ok ? await reloadItems() : toast.error(await res.text());
		},
		[reloadItems]
	);

	const addItemVariant = useCallback(
		async (variant: Partial<ItemVariant>) => {
			const res = await fetch(`${api}/item_variants/`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(variant),
			});
			res.ok ? await reloadItems() : toast.error(await res.text());
		},
		[reloadItems]
	);

	const updateItemVariant = useCallback(
		async (variant: ItemVariant) => {
			const res = await fetch(`${api}/item_variants/${variant.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(variant),
			});
			res.ok ? await reloadItems() : toast.error(await res.text());
		},
		[reloadItems]
	);

	const deleteItemVariant = useCallback(
		async (id: number) => {
			const res = await fetch(`${api}/item_variants/${id}`, {
				method: 'DELETE',
			});
			res.ok ? await reloadItems() : toast.error(await res.text());
		},
		[reloadItems]
	);

	const updateCategorySorting = useCallback(
		async (orderedCategoryIds: number[]) => {
			const res = await fetch(`${api}/categories/bulk`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ordered_category_ids: orderedCategoryIds }),
			});
			res.ok ? await reloadCategories() : toast.error(await res.text());
		},
		[reloadCategories]
	);

	const updateItemSorting = useCallback(
		async (orderedItemIds: number[]) => {
			try {
				const res = await fetch(`${api}/item-sorting/`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ ordered_item_ids: orderedItemIds }),
				});

				if (res.ok) {
					await reloadItems();
				} else {
					const errorText = await res.text();
					toast.error(errorText);
				}
			} catch (error) {
				toast.error('Fehler beim Sortieren der Artikel');
			}
		},
		[reloadItems]
	);

	useEffect(() => {
		reloadAll();
	}, [reloadAll]);

	return (
		<ProductContext.Provider
			value={{
				categories,
				items,
				reloadAll,
				addCategory,
				updateCategory,
				deleteCategory,
				addItem,
				updateItem,
				deleteItem,
				addItemVariant,
				updateItemVariant,
				deleteItemVariant,
				updateCategorySorting,
				updateItemSorting,
			}}
		>
			{children}
		</ProductContext.Provider>
	);
};

export const useProduct = () => {
	const context = useContext(ProductContext);
	if (!context) {
		throw new Error('useProduct must be used within a ProductProvider');
	}
	return context;
};
