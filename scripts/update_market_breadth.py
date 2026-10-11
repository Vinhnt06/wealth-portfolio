#!/usr/bin/env python3
"""
Calculate verified market breadth (Ceiling, Advances, Ref, Declines, Floor)
from real stock prices across HOSE, VN30, HNX, UPCOM via vnstock.
Zero mock data: all values are directly computed from actual exchange trading boards.
Follows Vietnamese official exchange reporting standards:
- Total Advances includes ceiling stocks
- Total Declines includes floor stocks
- Reference / NoChanges counts active traded stocks at reference price (excludes no-trade stocks)
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
            stock_list = stocks if isinstance(stocks, list) else stocks.tolist() if hasattr(stocks, 'tolist') else list(stocks)
        else:
            stock_list = df_sym[(df_sym['exchange'] == target) & (df_sym['type'] == 'stock')]['symbol'].tolist()

        df_pb = trading.price_board(stock_list)
        df_traded = df_pb[df_pb['close_price'] > 0]

        total_up = int((df_traded['close_price'] > df_traded['reference_price']).sum())
        ceil = int((df_traded['close_price'] == df_traded['ceiling_price']).sum())

        total_down = int((df_traded['close_price'] < df_traded['reference_price']).sum())
        floor = int((df_traded['close_price'] == df_traded['floor_price']).sum())

        ref = int((df_traded['close_price'] == df_traded['reference_price']).sum())
        no_trade = int((df_pb['close_price'] == 0).sum())

        result[sym] = {
            'symbol': sym,
            'ceilingCount': ceil,
            'advances': total_up,
            'noChanges': ref,
            'declines': total_down,
            'floorCount': floor,
            'noTradeCount': no_trade,
            'tradedStocks': len(df_traded),
            'totalStocks': len(stock_list),
            'updatedAt': int(time.time() * 1000)
        }
        print(f"[{sym}] Tăng={total_up} (Trần={ceil}) | TC={ref} | Giảm={total_down} (Sàn={floor}) | Không GD={no_trade} (Tổng={len(stock_list)}) in {time.time()-t0:.2f}s")

    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    out_path = os.path.join(root_dir, 'frontend', 'src', 'features', 'market', 'data', 'lastSessionBreadth.json')
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(f"Successfully saved authentic market breadth snapshot to {out_path}")

if __name__ == '__main__':
    compute_breadth()
