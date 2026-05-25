# Catalog Excel updates

Place **`today_update.xlsx`** here (sheet name **`Export`**).

Expected columns (in addition to existing fields):

| Column | Maps to |
|--------|---------|
| **UPC** | `upc` (digits only, e.g. `081652000020`) |
| **PL** | `palletSize` (板数；列名也可用 `PALLETSIZE`，与 PL 相同) |

After saving a file with UPC / pallet columns:

```bash
npm run catalog:patch-upc-pallet
```

This also sets **`importedAt`** on every SKU in the spreadsheet.

- **New items** tab: imported within **60 days**
- **JUST ADDED** badge on cards: imported within **14 days**

Or full rebuild from Excel (status, inventory, UPC, pallet, etc.):

```bash
npm run catalog:rebuild
```

Admin **Products → Upload today_update.xlsx** also applies **Status**, **UPC**, and **pallet size** to Redis overrides.
