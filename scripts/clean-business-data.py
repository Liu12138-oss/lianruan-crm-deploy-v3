"""
清空业务历史数据脚本
用法:
  python clean-business-data.py --dry-run   # 预检，仅展示不删除
  python clean-business-data.py             # 执行清理（自动先备份）
"""
import json, sys, os, shutil, datetime

sys.stdout.reconfigure(encoding='utf-8')

DATA_FILE = os.path.join(os.path.dirname(__file__), '..', 'backend', 'data.json')
DATA_FILE = os.path.abspath(DATA_FILE)

is_dry_run = '--dry-run' in sys.argv


def load_db():
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_db(db):
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(db, f, ensure_ascii=False, indent=2)


def summarize(label, items, preview_fields):
    count = len(items)
    print(f'\n  [{label}] {count} 条')
    if count == 0:
        print('    (已为空)')
        return
    if is_dry_run:
        for item in items[:3]:
            parts = []
            for field in preview_fields:
                v = item.get(field, '')
                if isinstance(v, (int, float)) and field == 'total':
                    v = f'{v:,.0f}'
                parts.append(str(v)[:30])
            print('    - ' + ' | '.join(parts))
        if count > 3:
            print(f'    ... 还有 {count - 3} 条')


def main():
    print('=' * 60)
    print('[清空业务历史数据]')
    print('=' * 60)

    db = load_db()

    # 统计要清空的数据
    ops_to_delete = db['opportunities']
    reg_to_delete = db['registrations']
    quo_to_delete = db['quotes']
    ord_to_delete = db['orders']
    apr_to_delete = db['pendingApprovals']
    par_to_delete = db['partners']
    staff_to_delete = [u for u in db['users'] if u.get('role') == 'staff']

    print('\n=== 待清空数据预览 ===')
    summarize('商机 opportunities',    ops_to_delete, ['id', 'name', 'customer'])
    summarize('客户报备 registrations',reg_to_delete, ['id', 'customer'])
    summarize('报价 quotes',           quo_to_delete, ['id', 'customer', 'total'])
    summarize('订单 orders',          ord_to_delete, ['id', 'customer'])
    summarize('审核 pendingApprovals',apr_to_delete, ['id', 'type', 'targetName'])
    summarize('渠道商 partners',      par_to_delete, ['id', 'name'])
    summarize('渠道商员工账号 staff',  staff_to_delete, ['id', 'name', 'partnerId'])

    # 保留的数据
    admin_keep  = [u for u in db['users'] if u.get('role') in ('admin', 'superadmin')]
    print(f'\n  [保留] 系统管理员账号 {len(admin_keep)} 人（admin + superadmin）')
    print(f'  [保留] 产品目录 categories={len(db["categories"])} modules={len(db["modules"])} features={len(db["features"])}')
    print(f'  [保留] 硬件产品 hardwareProducts={len(db["hardwareProducts"])} 套餐 packages={len(db["packages"])}')

    total_del = len(ops_to_delete) + len(reg_to_delete) + len(quo_to_delete) + \
                len(ord_to_delete) + len(apr_to_delete) + len(par_to_delete) + len(staff_to_delete)
    print(f'\n  总计删除: {total_del} 条记录')

    if is_dry_run:
        print('\n[DRY-RUN 模式] 以上数据不会被删除。')
        print('去掉 --dry-run 参数即可执行实际清理。')
        return

    # 实际执行
    print('\n' + '=' * 60)
    print('[开始执行清理]')
    print('=' * 60)

    # 1. 备份
    ts = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_path = DATA_FILE + f'.backup_biz_{ts}.json'
    shutil.copy2(DATA_FILE, backup_path)
    print(f'  [备份] {os.path.basename(backup_path)}')

    # 2. 清空
    db['opportunities'] = []
    db['registrations'] = []
    db['quotes'] = []
    db['orders'] = []
    db['pendingApprovals'] = []
    db['partners'] = []
    db['users'] = admin_keep  # 只保留 admin + superadmin

    # 3. 写回
    save_db(db)
    print('  [写入] data.json 已更新')

    # 4. 验证
    print('\n=== 清理后数据验证 ===')
    for key in ['opportunities', 'registrations', 'quotes', 'orders', 'pendingApprovals', 'partners']:
        count = len(db[key])
        mark = 'OK' if count == 0 else 'WARN'
        print(f'  {mark} {key}: {count} 条')

    staff_count = len([u for u in db['users'] if u.get('role') == 'staff'])
    admin_count = len([u for u in db['users'] if u.get('role') in ('admin', 'superadmin')])
    print(f'  OK users: staff={staff_count} (应为0), admin/superadmin={admin_count}')

    print('\n清理完成！如需恢复，请使用备份文件:')
    print(f'  {backup_path}')


if __name__ == '__main__':
    main()