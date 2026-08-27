import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import type { 应用配置 } from "@lianruan/config";
import { Pool, type PoolClient } from "pg";

import {
  校验订单预审字段映射,
  泛微订单预审客户端,
  订单预审外部错误,
} from "./order-preapproval-eteams.js";
import { 生成订单预审报价单PDF } from "./order-preapproval-pdf.js";
import { 企微订单预审群客户端, 解密订单预审企微应用凭据 } from "./order-preapproval-wecom.js";

const 订单预审事件代码 = "crm.order.preapproval.requested";
const 最大自动重试次数 = 4;
const 固定群成员登录名 = ["liangwanqi", "liangguangyao", "shoulong", "liulonghai"] as const;
const 群主登录名 = "liangguangyao";

interface 已领取订单预审事件 {
  eventId: string;
  requestId: string;
  retryCount: number;
  leaseToken: string;
}

interface 订单预审请求详情 {
  requestId: string;
  requestStatus:
    "pending" | "processing" | "accepted" | "failed" | "manual_confirmation_required" | "stopped";
  triggerCode: "region_confirmed" | "superadmin_confirmed_after_price_adjust";
  orderId: string;
  orderNo: string;
  orderStatus: string;
  quoteNo: string;
  contractPartner: string;
  endUser: string;
  regionId: string;
  regionValue: string | null;
  regionManagerUserId: string | null;
  templateId: string | null;
  templateStatus: "active" | "disabled" | "invalid" | null;
  templateVersion: string;
  workflowId: string | null;
  formId: string | null;
  fieldMapping: unknown;
  externalRequestId: string | null;
  items: Array<{ name: string; quantity: string; unitPrice: string; lineAmount: string }>;
  totalAmount: string;
}

interface 泛微身份 {
  userId: string;
  externalSubject: string;
}

interface 企微群成员 {
  userId: string;
  username: string;
  wecomUserId: string;
}

interface 群记录 {
  id: string;
  statusCode:
    "pending" | "processing" | "created" | "failed" | "manual_confirmation_required" | "stopped";
  chatId: string | null;
}

/**
 * 订单预审使用独立发件箱消费者。它仅改变 integration 事实和受控附件，不回写订单状态。
 */
export class 订单预审任务存储 {
  private readonly 数据库连接池: Pool;

  public constructor(
    private readonly config: 应用配置,
    private readonly 泛微客户端: 泛微订单预审客户端 = new 泛微订单预审客户端(
      config.orderPreapproval,
    ),
    private readonly 创建企微客户端: (凭据: {
      corpId: string;
      secret: string;
    }) => 企微订单预审群客户端 = (凭据) =>
      new 企微订单预审群客户端(凭据, config.orderPreapproval.requestTimeoutMs),
  ) {
    if (!config.database.url) throw new Error("订单预审任务进程启动失败：未配置 DATABASE_URL。");
    this.数据库连接池 = new Pool({ connectionString: config.database.url, max: 3 });
  }

  public async close(): Promise<void> {
    await this.数据库连接池.end();
  }

  public async 处理下一事件(): Promise<boolean> {
    const 事件 = await this.领取事件();
    if (!事件) return false;
    try {
      await this.处理事件(事件);
      await this.完成事件(事件);
    } catch (错误) {
      await this.记录事件失败(事件, 错误);
    }
    return true;
  }

  private async 领取事件(): Promise<已领取订单预审事件 | null> {
    const db = await this.数据库连接池.connect();
    try {
      await db.query("BEGIN");
      const 结果 = await db.query<{
        event_id: string;
        request_id: string;
        retry_count: number;
        lease_token: string;
      }>(
        `WITH candidate AS (
           SELECT event.id, request.id AS request_id
           FROM ops.outbox_events event
           JOIN integration.order_preapproval_requests request ON request.id=event.aggregate_id
           LEFT JOIN integration.order_preapproval_groups group_record ON group_record.request_id=request.id
           WHERE event.event_type=$1
             AND event.created_at >= $2::timestamptz
             AND (
               event.status_code='pending'
               OR (event.status_code='failed' AND event.next_retry_at IS NOT NULL AND event.next_retry_at<=now())
               OR (event.status_code='processing' AND event.next_retry_at IS NOT NULL AND event.next_retry_at<=now())
             )
             AND (
               request.status_code IN ('pending','processing')
               OR (request.status_code='accepted' AND group_record.status_code IN ('pending','processing'))
             )
           ORDER BY event.created_at,event.id
           FOR UPDATE OF event,request SKIP LOCKED
           LIMIT 1
         ), leased AS (
           UPDATE ops.outbox_events event
           SET status_code='processing',next_retry_at=now()+interval '5 minutes',
               payload_json=event.payload_json || jsonb_build_object('leaseToken',gen_random_uuid()::text)
           FROM candidate
           WHERE event.id=candidate.id
           RETURNING event.id::text AS event_id,candidate.request_id::text AS request_id,
                     event.retry_count,event.payload_json->>'leaseToken' AS lease_token
         )
         UPDATE integration.order_preapproval_requests request
         SET status_code=CASE WHEN request.status_code='pending' THEN 'processing' ELSE request.status_code END,
             started_at=COALESCE(request.started_at,now()),updated_at=now(),row_version=row_version+1
         FROM leased
         WHERE request.id=leased.request_id
         RETURNING leased.event_id,leased.request_id,leased.retry_count,leased.lease_token`,
        [订单预审事件代码, this.config.orderPreapproval.eventCutoverAt],
      );
      await db.query("COMMIT");
      const 行 = 结果.rows[0];
      return 行
        ? {
            eventId: 行.event_id,
            requestId: 行.request_id,
            retryCount: 行.retry_count,
            leaseToken: 行.lease_token,
          }
        : null;
    } catch (错误) {
      await db.query("ROLLBACK");
      throw 错误;
    } finally {
      db.release();
    }
  }

  private async 处理事件(事件: 已领取订单预审事件): Promise<void> {
    const 请求 = await this.读取请求详情(事件.requestId);
    if (请求.requestStatus === "accepted") {
      await this.确保已建群(请求);
      return;
    }
    if (请求.templateStatus !== "active") {
      throw new 订单预审外部错误(
        "ORDER_PREAPPROVAL_TEMPLATE_DISABLED",
        "订单预审模板已停用或失效，已停止自动外呼。",
        {},
      );
    }
    if (请求.externalRequestId) {
      await this.回查已有流程并建群(请求);
      return;
    }
    this.校验订单仍可发起(请求);
    const 字段映射 = 校验订单预审字段映射(请求.fieldMapping);
    const 发起人 = await this.读取唯一泛微身份(请求.regionManagerUserId);
    if (!请求.regionValue) {
      throw new 订单预审外部错误(
        "ORDER_PREAPPROVAL_REGION_MAPPING_MISSING",
        "订单所属区域未维护泛微真实选项映射。",
        {},
      );
    }
    const 报价单 = await this.读取或生成报价单(请求);
    await this.记录调用(请求.requestId, "oa_upload_purchase", "started", { hasQuotePdf: true });
    const 采购订单附件 = await this.泛微客户端.上传报价单(
      发起人.externalSubject,
      报价单.fileName,
      报价单.content,
    );
    await this.记录调用(请求.requestId, "oa_upload_purchase", "accepted", { hasQuotePdf: true });
    await this.记录调用(请求.requestId, "oa_upload_quote", "started", { hasQuotePdf: true });
    const 报价附件 = await this.泛微客户端.上传报价单(
      发起人.externalSubject,
      报价单.fileName,
      报价单.content,
    );
    await this.记录调用(请求.requestId, "oa_upload_quote", "accepted", { hasQuotePdf: true });

    await this.记录调用(请求.requestId, "oa_create", "started", {
      templateVersion: 请求.templateVersion,
    });
    const 流程编号 = await this.泛微客户端.创建并流转流程({
      workflowId: 请求.workflowId || "",
      formId: 请求.formId || "",
      发起人泛微编号: 发起人.externalSubject,
      订单编号: 请求.orderNo,
      合同对方: 请求.contractPartner,
      最终用户: 请求.endUser,
      所属区域: 请求.regionValue,
      字段映射,
      采购订单附件,
      报价单附件: 报价附件,
    });
    await this.记录流程编号(请求.requestId, 流程编号);
    await this.记录调用(请求.requestId, "oa_create", "accepted", { hasExternalRequestId: true });

    await this.回查已有流程并建群({ ...请求, externalRequestId: 流程编号, fieldMapping: 字段映射 });
  }

  private async 回查已有流程并建群(请求: 订单预审请求详情): Promise<void> {
    const 字段映射 = 校验订单预审字段映射(请求.fieldMapping);
    const 发起人 = await this.读取唯一泛微身份(请求.regionManagerUserId);
    if (!请求.regionValue || !请求.externalRequestId) {
      throw new 订单预审外部错误(
        "ORDER_PREAPPROVAL_VERIFY_DATA_MISSING",
        "订单预审缺少流程回查所需数据。",
        {},
      );
    }
    await this.记录调用(请求.requestId, "oa_verify", "started", { hasExternalRequestId: true });
    await this.泛微客户端.回查流程(发起人.externalSubject, 请求.externalRequestId, {
      订单编号: 请求.orderNo,
      所属区域: 请求.regionValue,
      产品类型: 字段映射.productTypeValue,
      采购内容: 字段映射.purchaseContentValue,
      采购订单字段编号: 字段映射.fields.purchaseAttachment.fieldId,
      报价单字段编号: 字段映射.fields.quoteAttachment.fieldId,
    });
    await this.记录调用(请求.requestId, "oa_verify", "accepted", { hasExternalRequestId: true });
    await this.标记泛微已受理(请求);
    await this.确保已建群({ ...请求, requestStatus: "accepted" });
  }

  private 校验订单仍可发起(请求: 订单预审请求详情): void {
    const 期望状态 =
      请求.triggerCode === "region_confirmed" ? "pending_superadmin_confirm" : "confirmed";
    if (请求.orderStatus !== 期望状态) {
      throw new 订单预审外部错误(
        "ORDER_PREAPPROVAL_ORDER_STATE_CHANGED",
        "订单状态已变化，已停止自动发起预审。",
        {},
      );
    }
    if (!请求.workflowId || !请求.formId || !请求.templateId) {
      throw new 订单预审外部错误(
        "ORDER_PREAPPROVAL_TEMPLATE_INVALID",
        "订单预审模板快照不完整。",
        {},
      );
    }
    for (const 值 of [请求.orderNo, 请求.contractPartner, 请求.endUser, 请求.regionId]) {
      if (!值.trim())
        throw new 订单预审外部错误(
          "ORDER_PREAPPROVAL_SOURCE_DATA_MISSING",
          "订单预审缺少必要业务数据。",
          {},
        );
    }
  }

  private async 读取请求详情(requestId: string): Promise<订单预审请求详情> {
    const 结果 = await this.数据库连接池.query<{
      request_id: string;
      request_status: 订单预审请求详情["requestStatus"];
      trigger_code: 订单预审请求详情["triggerCode"];
      order_id: string;
      order_no: string;
      order_status: string;
      quote_no: string | null;
      contract_partner: string | null;
      end_user: string | null;
      region_id: string | null;
      region_value: string | null;
      region_manager_user_id: string | null;
      template_id: string | null;
      template_status: 订单预审请求详情["templateStatus"];
      template_version: string;
      workflow_id: string | null;
      form_id: string | null;
      field_mapping: unknown;
      external_request_id: string | null;
      items: unknown;
      total_amount: string;
    }>(
      `SELECT request.id::text AS request_id,request.status_code AS request_status,request.trigger_code,
              order_record.id::text AS order_id,COALESCE(order_record.order_no,order_record.id::text) AS order_no,
              order_record.status_code AS order_status,COALESCE(quote.quote_no,quote.id::text) AS quote_no,
              partner.partner_name AS contract_partner,customer.customer_name AS end_user,
              region.id::text AS region_id,region_mapping.external_value AS region_value,
              request.region_manager_user_id::text,request.template_id::text,template.status_code AS template_status,request.template_version,
              request.template_snapshot_json->>'workflowId' AS workflow_id,
              request.template_snapshot_json->>'formId' AS form_id,
              request.template_snapshot_json->'fieldMapping' AS field_mapping,
              request.external_request_id,
              COALESCE(items.items,'[]'::jsonb) AS items,order_record.total_amount::text AS total_amount
       FROM integration.order_preapproval_requests request
       JOIN crm.orders order_record ON order_record.id=request.order_id
       LEFT JOIN integration.order_preapproval_templates template ON template.id=request.template_id
       LEFT JOIN crm.quotes quote ON quote.id=order_record.quote_id
       LEFT JOIN channel.partners partner ON partner.id=order_record.partner_id
       LEFT JOIN crm.customers customer ON customer.id=order_record.customer_id
       LEFT JOIN org.regions region ON region.id=partner.region_id
       LEFT JOIN integration.order_preapproval_region_mappings region_mapping
         ON region_mapping.template_id=request.template_id AND region_mapping.region_id=region.id
        AND region_mapping.status_code='active'
       LEFT JOIN LATERAL (
         SELECT jsonb_agg(jsonb_build_object(
           'name',item.item_name,'quantity',item.quantity::text,
           'unitPrice',item.unit_price::text,'lineAmount',item.line_amount::text
         ) ORDER BY item.id) AS items
         FROM crm.order_items item WHERE item.order_id=order_record.id
       ) items ON true
       WHERE request.id=$1::uuid`,
      [requestId],
    );
    const 行 = 结果.rows[0];
    if (!行)
      throw new 订单预审外部错误("ORDER_PREAPPROVAL_REQUEST_NOT_FOUND", "订单预审请求不存在。", {});
    if (!行.region_id)
      throw new 订单预审外部错误("ORDER_PREAPPROVAL_REGION_MISSING", "订单未关联有效区域。", {});
    return {
      requestId: 行.request_id,
      requestStatus: 行.request_status,
      triggerCode: 行.trigger_code,
      orderId: 行.order_id,
      orderNo: 行.order_no,
      orderStatus: 行.order_status,
      quoteNo: 行.quote_no || "",
      contractPartner: 行.contract_partner || "",
      endUser: 行.end_user || "",
      regionId: 行.region_id,
      regionValue: 行.region_value,
      regionManagerUserId: 行.region_manager_user_id,
      templateId: 行.template_id,
      templateStatus: 行.template_status,
      templateVersion: 行.template_version,
      workflowId: 行.workflow_id,
      formId: 行.form_id,
      fieldMapping: 行.field_mapping,
      externalRequestId: 行.external_request_id,
      items: 解析订单明细(行.items),
      totalAmount: 行.total_amount,
    };
  }

  private async 读取唯一泛微身份(userId: string | null): Promise<泛微身份> {
    if (!userId)
      throw new 订单预审外部错误(
        "ORDER_PREAPPROVAL_INITIATOR_MISSING",
        "订单预审未固化所属区域区管。",
        {},
      );
    const 结果 = await this.数据库连接池.query<{ external_subject: string }>(
      `SELECT identity.external_subject
       FROM iam.external_identities identity
       JOIN iam.users user_record ON user_record.id=identity.user_id
       WHERE identity.user_id=$1::uuid AND identity.provider_code='eteams'
         AND identity.status_code='active' AND user_record.status_code='active'`,
      [userId],
    );
    if (结果.rows.length !== 1 || !结果.rows[0]?.external_subject) {
      throw new 订单预审外部错误(
        "ORDER_PREAPPROVAL_INITIATOR_MAPPING_INVALID",
        "所属区管缺少唯一有效的泛微 userid 映射。",
        {},
      );
    }
    return { userId, externalSubject: 结果.rows[0].external_subject };
  }

  private async 读取或生成报价单(
    请求: 订单预审请求详情,
  ): Promise<{ fileName: string; content: Buffer }> {
    const fileKey = `order-preapproval-quote-pdf:${请求.requestId}`;
    const 已有 = await this.数据库连接池.query<{ original_name: string; storage_path: string }>(
      "SELECT original_name,storage_path FROM ops.files WHERE file_key=$1",
      [fileKey],
    );
    const 已有文件 = 已有.rows[0];
    if (已有文件) {
      const 路径 = this.校验报价单存储路径(已有文件.storage_path);
      return { fileName: 已有文件.original_name, content: await fs.readFile(路径) };
    }
    const fileName = `渠道产品订单预审报价单-${规范文件片段(请求.orderNo)}.pdf`;
    const content = 生成订单预审报价单PDF({
      订单编号: 请求.orderNo,
      报价编号: 请求.quoteNo,
      合同对方: 请求.contractPartner,
      最终用户: 请求.endUser,
      所属区域: 请求.regionValue || "",
      明细: 请求.items.map((项目) => ({
        名称: 项目.name,
        数量: 项目.quantity,
        单价: 项目.unitPrice,
        金额: 项目.lineAmount,
      })),
      合计金额: 请求.totalAmount,
      生成时间: new Date().toISOString(),
    });
    const 目录 = this.报价单目录();
    const 存储路径 = path.join(目录, 请求.requestId, fileName);
    await fs.mkdir(path.dirname(存储路径), { recursive: true });
    await fs.writeFile(存储路径, content, { flag: "wx" }).catch(async (错误: unknown) => {
      if ((错误 as NodeJS.ErrnoException).code !== "EEXIST") throw 错误;
    });
    const 实际内容 = await fs.readFile(存储路径);
    const sha256 = crypto.createHash("sha256").update(实际内容).digest("hex");
    await this.数据库连接池.query(
      `INSERT INTO ops.files(file_key,original_name,mime_type,file_size,sha256,storage_path,owner_user_id)
       VALUES($1,$2,'application/pdf',$3,$4,$5,$6::uuid) ON CONFLICT(file_key) DO NOTHING`,
      [fileKey, fileName, 实际内容.length, sha256, 存储路径, 请求.regionManagerUserId],
    );
    return { fileName, content: 实际内容 };
  }

  private async 记录流程编号(requestId: string, externalRequestId: string): Promise<void> {
    await this.数据库连接池.query(
      `UPDATE integration.order_preapproval_requests
       SET external_request_id=$2,status_code='processing',updated_at=now(),row_version=row_version+1
       WHERE id=$1::uuid AND external_request_id IS NULL`,
      [requestId, externalRequestId],
    );
  }

  private async 标记泛微已受理(请求: 订单预审请求详情): Promise<void> {
    const db = await this.数据库连接池.connect();
    try {
      await db.query("BEGIN");
      const 更新 = await db.query<{ id: string }>(
        `UPDATE integration.order_preapproval_requests
         SET status_code='accepted',accepted_at=now(),failure_code=NULL,failure_summary=NULL,
             updated_at=now(),row_version=row_version+1
         WHERE id=$1::uuid AND status_code='processing' AND external_request_id IS NOT NULL
         RETURNING id::text AS id`,
        [请求.requestId],
      );
      if (!更新.rows[0]) throw new Error("订单预审请求状态冲突，无法确认泛微已受理。");
      await db.query(
        `INSERT INTO integration.order_preapproval_groups(request_id,owner_user_id,member_user_ids_json,status_code)
         VALUES($1::uuid,NULL,'[]'::jsonb,'pending') ON CONFLICT(request_id) DO NOTHING`,
        [请求.requestId],
      );
      await this.写入审计(db, 请求, "oa.accepted", "success", "泛微 OA 已受理订单预审流程。");
      await db.query("COMMIT");
    } catch (错误) {
      await db.query("ROLLBACK");
      throw 错误;
    } finally {
      db.release();
    }
  }

  private async 确保已建群(请求: 订单预审请求详情): Promise<void> {
    const 群 = await this.读取群记录(请求.requestId);
    if (
      !群 ||
      群.statusCode === "created" ||
      群.statusCode === "failed" ||
      群.statusCode === "manual_confirmation_required"
    )
      return;
    try {
      const 成员 = await this.读取企微群成员(请求.regionManagerUserId);
      const 凭据 = await this.读取企微应用凭据();
      const 客户端 = this.创建企微客户端(凭据);
      const 群编号 = `op_${请求.requestId.replace(/-/g, "")}`;
      const 群名称 = `订单预审-${请求.orderNo}`.slice(0, 64);
      await this.标记群处理中(请求.requestId, 成员);
      await this.记录调用(请求.requestId, "wecom_group_create", "started", {
        memberCount: 成员.length,
      });
      const chatId =
        (await 客户端.查询群(群编号)) ||
        (await 客户端.创建群({
          群编号,
          群名称,
          群主企微编号: 成员.find((成员项) => 成员项.username === 群主登录名)?.wecomUserId || "",
          成员企微编号: [...new Set(成员.map((成员项) => 成员项.wecomUserId))],
        }));
      await this.标记群已创建(请求.requestId, chatId, 成员);
      await this.记录调用(请求.requestId, "wecom_group_create", "accepted", {
        memberCount: 成员.length,
      });
      try {
        await this.记录调用(请求.requestId, "wecom_group_notice", "started", {});
        await 客户端.发送群通知(chatId);
        await this.记录调用(请求.requestId, "wecom_group_notice", "accepted", {});
      } catch (错误) {
        await this.记录调用(请求.requestId, "wecom_group_notice", "failed", {}, 错误);
      }
    } catch (错误) {
      await this.标记群失败(请求.requestId, 错误);
      const 外部错误 = 错误 instanceof 订单预审外部错误 ? 错误 : undefined;
      await this.记录调用(
        请求.requestId,
        "wecom_group_create",
        外部错误?.manualConfirmationRequired ? "manual_confirmation_required" : "failed",
        {},
        错误,
      );
      if (错误 instanceof 订单预审外部错误 && 错误.retryable) throw 错误;
    }
  }

  private async 读取群记录(requestId: string): Promise<群记录 | null> {
    const 结果 = await this.数据库连接池.query<{
      id: string;
      status_code: 群记录["statusCode"];
      chat_id: string | null;
    }>(
      "SELECT id::text,status_code,chat_id FROM integration.order_preapproval_groups WHERE request_id=$1::uuid",
      [requestId],
    );
    const 行 = 结果.rows[0];
    return 行 ? { id: 行.id, statusCode: 行.status_code, chatId: 行.chat_id } : null;
  }

  private async 读取企微应用凭据(): Promise<{ corpId: string; secret: string }> {
    const 结果 = await this.数据库连接池.query<{
      cipher_text: string;
      nonce: string;
      auth_tag: string;
      enabled: boolean;
    }>(
      "SELECT cipher_text,nonce,auth_tag,enabled FROM message.channel_accounts WHERE channel_code='wecom_app' LIMIT 1",
    );
    const 行 = 结果.rows[0];
    if (!行 || !行.enabled)
      throw new 订单预审外部错误("WECOM_CHANNEL_UNAVAILABLE", "消息平台企微自建应用未启用。", {});
    return 解密订单预审企微应用凭据(
      { cipherText: 行.cipher_text, nonce: 行.nonce, authTag: 行.auth_tag },
      this.config.message.channelConfigEncryptionKey,
    );
  }

  private async 读取企微群成员(区域区管用户编号: string | null): Promise<企微群成员[]> {
    if (!区域区管用户编号)
      throw new 订单预审外部错误(
        "ORDER_PREAPPROVAL_INITIATOR_MISSING",
        "订单预审未固化所属区域区管。",
        {},
      );
    const 结果 = await this.数据库连接池.query<{
      user_id: string;
      username: string;
      identities: string[];
    }>(
      `SELECT user_record.id::text AS user_id,user_record.username::text AS username,
              COALESCE(array_remove(array_agg(identity.external_subject),NULL), ARRAY[]::text[]) AS identities
       FROM iam.users user_record
       LEFT JOIN iam.external_identities identity ON identity.user_id=user_record.id
         AND identity.provider_code='wecom' AND identity.status_code='active'
       WHERE user_record.status_code='active'
         AND (user_record.id=$1::uuid OR user_record.username=ANY($2::citext[]))
       GROUP BY user_record.id,user_record.username`,
      [区域区管用户编号, [...固定群成员登录名]],
    );
    const 期望账号 = new Set([区域区管用户编号, ...固定群成员登录名]);
    const 成员 = 结果.rows.map((行) => {
      if (行.identities.length !== 1 || !行.identities[0]) {
        throw new 订单预审外部错误(
          "WECOM_MEMBER_MAPPING_INVALID",
          `企微群成员“${行.username}”缺少唯一有效的企业微信 UserId 映射。`,
          {},
        );
      }
      return { userId: 行.user_id, username: 行.username, wecomUserId: 行.identities[0] };
    });
    const 已找到区管 = 成员.some((成员项) => 成员项.userId === 区域区管用户编号);
    const 已找到固定成员 = 固定群成员登录名.every((登录名) =>
      成员.some((成员项) => 成员项.username === 登录名),
    );
    if (
      !已找到区管 ||
      !已找到固定成员 ||
      !成员.some((成员项) => 成员项.username === 群主登录名) ||
      !期望账号.size
    ) {
      throw new 订单预审外部错误(
        "WECOM_MEMBER_MISSING",
        "订单预审企微群缺少区管或固定成员账号。",
        {},
      );
    }
    return 成员;
  }

  private async 标记群处理中(requestId: string, 成员: 企微群成员[]): Promise<void> {
    await this.数据库连接池.query(
      `UPDATE integration.order_preapproval_groups
       SET status_code='processing',owner_user_id=$2::uuid,member_user_ids_json=$3::jsonb,
           failure_code=NULL,failure_summary=NULL,updated_at=now(),row_version=row_version+1
       WHERE request_id=$1::uuid AND status_code IN ('pending','processing')`,
      [
        requestId,
        成员.find((成员项) => 成员项.username === 群主登录名)?.userId || null,
        JSON.stringify(成员.map((成员项) => 成员项.userId)),
      ],
    );
  }

  private async 标记群已创建(requestId: string, chatId: string, 成员: 企微群成员[]): Promise<void> {
    await this.数据库连接池.query(
      `UPDATE integration.order_preapproval_groups
       SET status_code='created',chat_id=$2,owner_user_id=$3::uuid,member_user_ids_json=$4::jsonb,
           completed_at=now(),failure_code=NULL,failure_summary=NULL,updated_at=now(),row_version=row_version+1
       WHERE request_id=$1::uuid AND status_code='processing'`,
      [
        requestId,
        chatId,
        成员.find((成员项) => 成员项.username === 群主登录名)?.userId || null,
        JSON.stringify(成员.map((成员项) => 成员项.userId)),
      ],
    );
  }

  private async 标记群失败(requestId: string, 错误: unknown): Promise<void> {
    const 外部错误 = 错误 instanceof 订单预审外部错误 ? 错误 : undefined;
    const 状态 = 外部错误?.retryable
      ? "pending"
      : 外部错误?.manualConfirmationRequired
        ? "manual_confirmation_required"
        : "failed";
    await this.数据库连接池.query(
      `UPDATE integration.order_preapproval_groups
       SET status_code=$2,failure_code=$3,failure_summary=$4,updated_at=now(),row_version=row_version+1
       WHERE request_id=$1::uuid AND status_code IN ('pending','processing')`,
      [requestId, 状态, 外部错误?.code || "WECOM_GROUP_UNEXPECTED_ERROR", 脱敏错误摘要(错误)],
    );
  }

  private async 记录调用(
    requestId: string,
    operationCode:
      | "oa_upload_purchase"
      | "oa_upload_quote"
      | "oa_create"
      | "oa_verify"
      | "wecom_group_create"
      | "wecom_group_notice",
    outcomeCode: "started" | "accepted" | "failed" | "manual_confirmation_required" | "stopped",
    requestSummary: Record<string, unknown>,
    错误?: unknown,
    db?: PoolClient,
  ): Promise<void> {
    const 外部错误 = 错误 instanceof 订单预审外部错误 ? 错误 : undefined;
    await (db || this.数据库连接池).query(
      `INSERT INTO integration.order_preapproval_invocations(
         request_id,operation_code,outcome_code,http_status,request_summary_json,response_summary_json,error_code,error_summary
       ) VALUES($1::uuid,$2,$3,$4,$5::jsonb,'{}'::jsonb,$6,$7)`,
      [
        requestId,
        operationCode,
        outcomeCode,
        外部错误?.httpStatus || null,
        JSON.stringify(requestSummary),
        外部错误?.code || null,
        错误 ? 脱敏错误摘要(错误) : null,
      ],
    );
  }

  private async 完成事件(事件: 已领取订单预审事件): Promise<void> {
    await this.数据库连接池.query(
      `UPDATE ops.outbox_events
       SET status_code='sent',next_retry_at=NULL
       WHERE id=$1::uuid AND status_code='processing' AND payload_json->>'leaseToken'=$2`,
      [事件.eventId, 事件.leaseToken],
    );
  }

  private async 记录事件失败(事件: 已领取订单预审事件, 错误: unknown): Promise<void> {
    const 外部错误 = 错误 instanceof 订单预审外部错误 ? 错误 : undefined;
    const 请求摘要 = await this.读取请求详情(事件.requestId);
    const 可自动重试 = Boolean(外部错误?.retryable) && 事件.retryCount + 1 < 最大自动重试次数;
    const 需人工确认 = Boolean(外部错误?.manualConfirmationRequired);
    const 应标记模板无效 =
      外部错误?.code === "ORDER_PREAPPROVAL_TEMPLATE_INVALID" ||
      外部错误?.code === "ETEAMS_VERIFY_FIELD_MISMATCH";
    const 应停止请求 =
      应标记模板无效 ||
      外部错误?.code === "ORDER_PREAPPROVAL_TEMPLATE_DISABLED" ||
      外部错误?.code === "ORDER_PREAPPROVAL_ORDER_STATE_CHANGED";
    const 请求状态 = 可自动重试
      ? null
      : 需人工确认
        ? "manual_confirmation_required"
        : 应停止请求
          ? "stopped"
          : "failed";
    const db = await this.数据库连接池.connect();
    try {
      await db.query("BEGIN");
      await db.query(
        `UPDATE ops.outbox_events
         SET status_code=$2,retry_count=retry_count+1,
             next_retry_at=CASE WHEN $3::boolean THEN now()+make_interval(secs=>$4) ELSE NULL END,
             payload_json=payload_json || jsonb_build_object('lastError',$5::text,'lastFailedAt',now(),
               'manualActionRequired',$6::boolean)
         WHERE id=$1::uuid AND status_code='processing' AND payload_json->>'leaseToken'=$7`,
        [
          事件.eventId,
          可自动重试 ? "failed" : "sent",
          可自动重试,
          Math.min(300, 2 ** Math.min(事件.retryCount + 1, 8)),
          脱敏错误摘要(错误),
          !可自动重试,
          事件.leaseToken,
        ],
      );
      if (请求状态) {
        await db.query(
          `UPDATE integration.order_preapproval_requests
           SET status_code=$2,failure_code=$3,failure_summary=$4,
               stopped_at=CASE WHEN $2='stopped' THEN now() ELSE stopped_at END,
               updated_at=now(),row_version=row_version+1
           WHERE id=$1::uuid AND status_code<>'accepted'`,
          [
            事件.requestId,
            请求状态,
            外部错误?.code || "ORDER_PREAPPROVAL_UNEXPECTED_ERROR",
            脱敏错误摘要(错误),
          ],
        );
        if (应标记模板无效) {
          await db.query(
            "UPDATE integration.order_preapproval_templates SET status_code='invalid',updated_at=now(),row_version=row_version+1 WHERE id=(SELECT template_id FROM integration.order_preapproval_requests WHERE id=$1::uuid)",
            [事件.requestId],
          );
        }
      } else if (可自动重试) {
        await db.query(
          "UPDATE integration.order_preapproval_requests SET status_code='pending',failure_code=$2,failure_summary=$3,updated_at=now(),row_version=row_version+1 WHERE id=$1::uuid AND status_code='processing'",
          [
            事件.requestId,
            外部错误?.code || "ORDER_PREAPPROVAL_RETRYABLE_ERROR",
            脱敏错误摘要(错误),
          ],
        );
      }
      const 是已受理后的群异常 = 请求摘要.requestStatus === "accepted";
      const 操作代码 = 是已受理后的群异常 ? "wecom_group_create" : "oa_create";
      const 审计动作 = 是已受理后的群异常 ? "wecom_group.failed" : "oa.failed";
      await this.记录调用(
        事件.requestId,
        操作代码,
        需人工确认 ? "manual_confirmation_required" : 请求状态 === "stopped" ? "stopped" : "failed",
        {},
        错误,
        db,
      );
      await this.写入审计(
        db,
        请求摘要,
        审计动作,
        请求状态 === "stopped" ? "stopped" : "failed",
        脱敏错误摘要(错误),
      );
      await db.query("COMMIT");
    } catch (记录错误) {
      await db.query("ROLLBACK");
      throw 记录错误;
    } finally {
      db.release();
    }
  }

  private async 写入审计(
    db: PoolClient,
    请求: 订单预审请求详情,
    动作: string,
    结果: string,
    说明: string,
  ): Promise<void> {
    await db.query(
      `INSERT INTO audit.audit_logs(
         created_at,request_id,actor_user_id,actor_username,actor_name,actor_role,module_code,action_code,
         target_type,target_id,result_code,message,after_json,extra_json
       ) VALUES(now(),$1,NULL,'system','订单预审任务','system','order_preapproval',$2,
                'order_preapproval_request',$3,$4,$5,$6::jsonb,$7::jsonb)`,
      [
        `order-preapproval-worker:${请求.requestId}`,
        动作,
        请求.requestId,
        结果,
        说明,
        JSON.stringify({
          orderId: 请求.orderId,
          triggerCode: 请求.triggerCode,
          templateVersion: 请求.templateVersion,
        }),
        JSON.stringify({ externalRequestAccepted: Boolean(请求.externalRequestId) }),
      ],
    );
  }

  private 报价单目录(): string {
    return path.resolve(this.config.orderPreapproval.fileDir);
  }

  private 校验报价单存储路径(存储路径: string): string {
    const 根目录 = this.报价单目录();
    const 绝对路径 = path.resolve(存储路径);
    if (绝对路径 !== 根目录 && !绝对路径.startsWith(`${根目录}${path.sep}`)) {
      throw new 订单预审外部错误(
        "ORDER_PREAPPROVAL_FILE_PATH_INVALID",
        "订单预审报价单存储路径不合法。",
        {},
      );
    }
    return 绝对路径;
  }
}

function 解析订单明细(原始: unknown): 订单预审请求详情["items"] {
  if (!Array.isArray(原始) || !原始.length) {
    throw new 订单预审外部错误(
      "ORDER_PREAPPROVAL_QUOTE_ITEMS_MISSING",
      "订单关联报价缺少采购明细。",
      {},
    );
  }
  return 原始.map((项目) => {
    if (!是记录(项目))
      throw new 订单预审外部错误(
        "ORDER_PREAPPROVAL_QUOTE_ITEMS_INVALID",
        "订单采购明细格式无效。",
        {},
      );
    const name = 取文本(项目.name);
    const quantity = 取文本(项目.quantity);
    const unitPrice = 取文本(项目.unitPrice);
    const lineAmount = 取文本(项目.lineAmount);
    if (!name || !quantity || !unitPrice || !lineAmount) {
      throw new 订单预审外部错误(
        "ORDER_PREAPPROVAL_QUOTE_ITEMS_INVALID",
        "订单采购明细缺少必要字段。",
        {},
      );
    }
    return { name, quantity, unitPrice, lineAmount };
  });
}

function 规范文件片段(值: string): string {
  return 值.replace(/[^\p{L}\p{N}_-]+/gu, "_").slice(0, 100) || "order";
}

function 脱敏错误摘要(错误: unknown): string {
  return (错误 instanceof Error ? 错误.message : "订单预审任务失败，原因未知。")
    .replace(/https?:\/\/[^\s]+/g, "[地址已隐藏]")
    .slice(0, 500);
}

function 是记录(值: unknown): 值 is Record<string, unknown> {
  return Boolean(值) && typeof 值 === "object" && !Array.isArray(值);
}

function 取文本(值: unknown): string {
  return typeof 值 === "string" || typeof 值 === "number" ? String(值) : "";
}
