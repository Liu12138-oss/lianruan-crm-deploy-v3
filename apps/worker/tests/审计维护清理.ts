import type { Pool } from "pg";

/** Worker 测试清理必须显式进入维护会话，生产业务代码不得调用本函数。 */
export async function 执行审计维护删除(
  连接池: Pool,
  条件: string,
  参数: readonly unknown[] = [],
): Promise<void> {
  const 客户端 = await 连接池.connect();
  try {
    await 客户端.query("BEGIN");
    await 客户端.query("SELECT set_config('lianruan.audit_maintenance', 'on', true)");
    await 客户端.query(`DELETE FROM audit.audit_logs WHERE ${条件}`, [...参数]);
    await 客户端.query("COMMIT");
  } catch (错误) {
    await 客户端.query("ROLLBACK").catch(() => undefined);
    throw 错误;
  } finally {
    客户端.release();
  }
}
