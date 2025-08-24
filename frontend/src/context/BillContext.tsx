import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { api } from '../assets/constants';

export interface BillItem {
	id: number;
	bill_id: number;
	item_variant_id: number;
	item_quantity: number;
	item_price: number;
}
export interface Bill {
	id: number;
	date: string;
	is_deleted?: boolean;
	items: BillItem[];
}

interface BillContextType {
	bills: Bill[];
	isShowingDeleted: boolean;
	reloadBills: () => Promise<void>;
	switchReloadWithDeleted: () => void;
	addBill: (bill: { date: string; items: { item_variant_id: number; item_quantity: number }[] }) => Promise<void>;
	deleteBill: (id: number) => Promise<void>;
}

const BillContext = createContext<BillContextType | undefined>(undefined);

export const BillProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const [includeDeleted, setIncludeDeleted] = useState(false);
	const [bills, setBills] = useState<Bill[]>([]);

	const switchReloadWithDeleted = () => {
		setIncludeDeleted((orig) => {
			const newValue = !orig;
			// Direkt mit dem neuen Wert neu laden
			loadBillsWithDeletedState(newValue);
			return newValue;
		});
	};

	const loadBillsWithDeletedState = async (withDeleted: boolean) => {
		const res = await fetch(`${api}/bills${withDeleted ? '/all' : '/'}`);
		if (!res.ok) {
			toast.error(await res.text());
			throw new Error('Failed to fetch bills');
		}
		setBills(await res.json());
	};

	const reloadBills = useCallback(async () => {
		await loadBillsWithDeletedState(includeDeleted);
	}, [includeDeleted]);

	const addBill = useCallback(
		async (bill: { date: string; items: { item_variant_id: number; item_quantity: number }[] }) => {
			const res = await fetch(`${api}/bills/`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(bill),
			});
			if (!res.ok) toast.error('Fehler beim Hinzufügen der Rechnung');
			else {
				toast.success('Rechnung hinzugefügt');
				reloadBills();
			}
		},
		[reloadBills]
	);

	const deleteBill = useCallback(
		async (id: number) => {
			const res = await fetch(`${api}/bills/${id}`, {
				method: 'DELETE',
			});
			if (!res.ok) toast.error('Fehler beim Löschen der Rechnung');
			else {
				toast.success('Rechnung gelöscht');
				reloadBills();
			}
		},
		[reloadBills]
	);

	useEffect(() => {
		void (async () => {
			await reloadBills();
		})();
	}, []);

	return (
		<BillContext.Provider
			value={{
				bills,
				reloadBills,
				addBill,
				deleteBill,
				isShowingDeleted: includeDeleted,
				switchReloadWithDeleted,
			}}
		>
			{children}
		</BillContext.Provider>
	);
};

export const useBill = () => {
	const context = useContext(BillContext);
	if (!context) {
		throw new Error('useBill must be used within a BillProvider');
	}
	return context;
};
