import React, { useState, useEffect } from 'react';
import * as MdIcons from 'react-icons/md';
import BaseModal from './BaseModal.component';
import { IconField } from '../CardInputFields.component';

interface Category {
	id: number;
	name: string;
	icon: string;
}

interface CategoryEditModalProps {
	isOpen: boolean;
	category: Category | null;
	isNewCategory?: boolean;
	onSave: (category: Category) => void;
	onClose: () => void;
}

export default function CategoryEditModal({ isOpen, category, isNewCategory = false, onSave, onClose }: CategoryEditModalProps) {
	const [editedCategory, setEditedCategory] = useState<Category | null>(null);

	// Update editedCategory when category prop changes
	useEffect(() => {
		setEditedCategory(category);
	}, [category]);

	if (!isOpen || !category || !editedCategory) return null;

	const handleNameChange = (value: string) => {
		setEditedCategory({ ...editedCategory, name: value });
	};

	const handleIconChange = (value: string) => {
		setEditedCategory({ ...editedCategory, icon: value });
	};

	const handleSave = () => {
		onSave(editedCategory);
	};

	const handleClose = () => {
		setEditedCategory(category); // Reset changes
		onClose();
	};

	return (
		<BaseModal
			isOpen={isOpen}
			onClose={handleClose}
			title={isNewCategory ? 'Neue Kategorie erstellen' : 'Kategorie bearbeiten'}
			inputContent={
				<div
					style={{
						display: 'flex',
						flexDirection: 'column',
						gap: 'var(--spacing-lg)',
					}}
				>
					<div
						style={{
							display: 'flex',
							flexDirection: 'column',
							gap: 'var(--spacing-sm)',
						}}
					>
						<label
							htmlFor="category-name"
							style={{
								fontWeight: 'var(--font-weight-medium)',
								color: 'var(--text-primary)',
							}}
						>
							Kategoriename
						</label>
						<input
							id="category-name"
							type="text"
							value={editedCategory.name}
							placeholder="Name eingeben..."
							onChange={(e) => handleNameChange(e.target.value)}
							autoFocus
							style={{
								padding: 'var(--spacing-md)',
								border: '1px solid var(--card-border)',
								borderRadius: 'var(--radius-md)',
								fontSize: 'var(--fs-200)',
								backgroundColor: 'var(--card-background)',
								color: 'var(--text-primary)',
							}}
						/>
					</div>

					<div
						style={{
							display: 'flex',
							flexDirection: 'column',
							gap: 'var(--spacing-sm)',
						}}
					>
						<label
							style={{
								fontWeight: 'var(--font-weight-medium)',
								color: 'var(--text-primary)',
							}}
						>
							Icon
						</label>
						<IconField isEditMode={true} value={editedCategory.icon} setValue={handleIconChange} icons={MdIcons} iconSize={32} />
					</div>
				</div>
			}
			commandContent={
				<>
					<button
						type="button"
						onClick={handleClose}
						className="secondaryButton"
						style={{
							padding: 'var(--spacing-md) var(--spacing-lg)',
							backgroundColor: 'transparent',
							color: 'var(--text-primary)',
							border: '1px solid var(--card-border)',
							borderRadius: 'var(--radius-md)',
							cursor: 'pointer',
							fontWeight: 'var(--font-weight-medium)',
						}}
					>
						Abbrechen
					</button>
					<button
						type="submit"
						onClick={handleSave}
						disabled={!editedCategory.name.trim()}
						className="primaryButton"
						style={{
							padding: 'var(--spacing-md) var(--spacing-lg)',
							backgroundColor: 'var(--color-accent)',
							color: 'var(--color-navy)',
							border: '1px solid var(--color-accent)',
							borderRadius: 'var(--radius-md)',
							cursor: 'pointer',
							fontWeight: 'var(--font-weight-medium)',
							opacity: !editedCategory.name.trim() ? 0.5 : 1,
						}}
					>
						{isNewCategory ? 'Erstellen' : 'Speichern'}
					</button>
				</>
			}
		/>
	);
}
