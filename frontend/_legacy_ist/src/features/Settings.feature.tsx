import { useState } from 'react';
import styles from './SettingsFeature.module.css';
import CategoryCardFeature from './CategoryCard.feature';
import ItemCardFeature from './ItemCard.feature';
import * as MdIcons from 'react-icons/md';

export default function SettingsFeature() {
	const [tab, setTab] = useState<'category' | 'item'>('category');

	const tabs = [
		{
			key: 'category' as const,
			label: 'Kategorien verwalten',
			icon: MdIcons.MdCategory,
			description: 'Kategorien erstellen und organisieren',
		},
		{
			key: 'item' as const,
			label: 'Artikel verwalten',
			icon: MdIcons.MdInventory,
			description: 'Artikel und Varianten bearbeiten',
		},
	];

	return (
		<div className={styles.settingsGrid}>
			{/* Premium Tab Bar mit Icons */}
			<div className={styles.tabBar}>
				{tabs.map((tabItem) => {
					const Icon = tabItem.icon;
					const isActive = tab === tabItem.key;

					return (
						<button key={tabItem.key} className={`${styles.tab} ${isActive ? styles.activeTab : ''}`} onClick={() => setTab(tabItem.key)} aria-selected={isActive} role="tab" title={tabItem.description}>
							<Icon size={20} />
							<span>{tabItem.label}</span>
						</button>
					);
				})}
			</div>

			{/* Content Area - Clean ohne redundante Überschriften */}
			<div className={styles.contentArea}>
				<div className={styles.contentBody}>{tab === 'category' ? <CategoryCardFeature /> : <ItemCardFeature />}</div>
			</div>
		</div>
	);
}
