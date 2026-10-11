#!/usr/bin/env python3
"""Builds public/products.txt from the product-list CSV.

Usage:  python3 scripts/build-products.py products.csv public/products.txt

Line 1 of the output is a JSON list of parent categories. Every other line is:
  sku_id|name|barcode1,barcode2|categoryIndex|stockOnHand|flags|pullType
flags: 1 = can_expire, 2 = is_active.   Deleted products and rows without a valid barcode are skipped.

pullType decides how many days BEFORE the printed expiry date a product must leave the shelf.
Edit the rules below (and the PULL table in public/index.html) if the policy changes.
  1 = bread (عيش)            -> 1 day before
  2 = meat and poultry       -> 2 days before
  3 = fresh cheese (جبن فريش) -> 1 day before
  4 = fresh vegetables/fruit -> 1 day before
"""
import csv, json, re, sys

def pull_type(r):
    parent, cat, sub = r['parent_category'], r['category'], r['subcategory']
    name = r['product_name']
    if re.search(r'frozen|مجمد', name, re.I):
        return 0
    if parent == 'Bakery' and cat in ('Flatbread', 'Toast', 'Buns & Rolls'):
        return 1
    if parent == 'Poultry, Meat & Seafood' and cat in ('Chicken & Poultry', 'Beef & Veal', 'Lamb & Goat'):
        return 2
    if parent == 'Fruit & Veg' and cat in ('Fresh Vegetables', 'Fresh Fruit', 'Herbs & Leafy Greens'):
        return 4
    cheese_area = parent in ('Dairy & Eggs', 'Cold Cuts & Deli') and 'cheese' in (cat + ' ' + sub + ' ' + name).lower()
    if cheese_area:
        if sub in ('White Cheese', 'Cottage Cheese'):
            return 3
        if re.search(r'fresh cheese|white cheese|cream cheese|cottage|feta|domiati|domty|جبن\w* فريش|فريش', name, re.I):
            return 3
    return 0

def main(src, dst):
    rows = list(csv.DictReader(open(src, encoding='utf-8-sig')))
    cats, idx, out = [], {}, []
    counts = {0: 0, 1: 0, 2: 0, 3: 0, 4: 0}
    for r in rows:
        if r['is_deleted'] == 'true':
            continue
        bcs = [b.strip() for b in r['barcodes'].split(',') if re.fullmatch(r'\d{8,14}', b.strip())]
        if not bcs:
            continue
        name = re.sub(r'\s+', ' ', r['product_name']).strip().replace('|', '/').replace('</', '< /')
        c = r['parent_category'] or 'أخرى'
        if c not in idx:
            idx[c] = len(cats); cats.append(c)
        try:
            stock = max(0, int(round(float(r['stock_on_hand'] or 0))))
        except ValueError:
            stock = 0
        flags = (1 if r['can_expire'] == 'true' else 0) | (2 if r['is_active'] == 'true' else 0)
        t = pull_type(r)
        counts[t] += 1
        out.append('|'.join([r['sku_id'], name, ','.join(bcs), str(idx[c]), str(stock), str(flags), str(t)]))
    open(dst, 'w', encoding='utf-8').write(json.dumps(cats, ensure_ascii=False) + '\n' + '\n'.join(out))
    print(len(out), 'products ->', dst, '| pull types:', counts)

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
