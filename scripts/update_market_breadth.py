#!/usr/bin/env python3
"""
Calculate verified market breadth (Ceiling, Advances, Ref, Declines, Floor)
from real stock prices across HOSE, VN30, HNX, UPCOM via vnstock.
Zero mock data: all values are directly computed from actual exchange trading boards.
"""
import json
import os
import sys
import time

try:
    from vnstock import Trading, Listing
except ImportError:
    print("Error: vnstock is required. Install via pip.")
    sys.exit(1)

def compute_breadth():
    print("Fetching constituents and price boards...")
    l = Listing()
    df_sym = l.symbols_by_exchange('HOSE')
    trading = Trading()

    configs = [
        ('VN30', 'group', 'VN30'),
        ('VNINDEX', 'exchange', 'HOSE'),
        ('HNX', 'exchange', 'HNX'),
        ('UPCOM', 'exchange', 'UPCOM'),
    ]

    result = {}

    for sym, kind, target in configs:
        t0 = time.time()
        if kind == 'group':
            stocks = l.symbols_by_group(target)
            if isinstance(stocks, list):
                stock_list = stocks
            elif hasattr(stocks, 'tolist'):
                stock_list = stocks.tolist()
            else:
                stock_list = list(stocks)
        else:
            stock_list = df_sym[(df_sym['exchange'] == target) & (df_sym['type'] == 'stock')]['symbol'].tolist()

        df_pb = trading.price_board(stock_list)
        ceil = int(((df_pb['close_price'] > 0) & (df_pb['close_price'] == df_pb['ceiling_price'])).sum())
        floor = int(((df_pb['close_price'] > 0) & (df_pb['close_price'] == df_pb['floor_price'])).sum())
        up = int(((df_pb['close_price'] > df_pb['reference_price']) & (df_pb['close_price'] < df_pb['ceiling_price'])).sum())
        down = int(((df_pb['close_price'] < df_pb['reference_price']) & (df_pb['close_price'] > df_pb['floor_price'])).sum())
        ref = int(((df_pb['close_price'] == df_pb['reference_price']) | (df_pb['close_price'] == 0)).sum())

        result[sym] = {
            'symbol': sym,
            'ceilingCount': ceil,
            'advances': up,
            'noChanges': ref,
            'declines': down,
            'floorCount': floor,
            'totalStocks': len(stock_list),
            'updatedAt': int(time.time() * 1000)
        }
        print(f"[{sym}] Ceil={ceil}, Up={up}, Ref={ref}, Down={down}, Floor={floor} (Total={len(stock_list)}) in {time.time()-t0:.2f}s")

    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    out_path = os.path.join(root_dir, 'frontend', 'src', 'features', 'market', 'data', 'lastSessionBreadth.json')
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(f"Successfully saved authentic market breadth snapshot to {out_path}")

if __name__ == '__main__':
    compute_breadth()
