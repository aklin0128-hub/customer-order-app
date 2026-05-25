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

`importedAt` is set **only the first time** a SKU appears in the catalog (not on every UPC/PL refresh).

- **New items** tab: only SKUs you check **Show in New items** in Admin → Products (not auto from Excel or `_NEW` in name)
- **JUST ADDED**: separate optional flag in Admin → Products (pin to top + red badge)

If every SKU was marked new after a bad import, run: `npm run catalog:fix-new-flags`

Or full rebuild from Excel (status, inventory, UPC, pallet, etc.):

```bash
npm run catalog:rebuild
```

Admin **Products → Upload today_update.xlsx** also applies **Status**, **UPC**, and **pallet size** to Redis overrides.
