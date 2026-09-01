import { 读取应用配置 } from "@lianruan/config";
import { describe, expect, it, vi } from "vitest";

import {
  读取泛微附件编号,
  序列化订单预审创建载荷,
  泛微订单预审客户端,
  type 订单预审字段映射,
} from "../src/order-preapproval-eteams.js";
import { 生成订单预审报价单PDF } from "../src/order-preapproval-pdf.js";
import { 企微订单预审群客户端 } from "../src/order-preapproval-wecom.js";
import { 启动订单预审任务服务 } from "../src/order-preapproval-worker.js";
import { 订单预审事件领取查询 } from "../src/order-preapproval-store.js";

const 字段映射: 订单预审字段映射 = {
  productTypeValue: "EPP渠道产品",
  purchaseContentValue: "详见采购订单上传处的报价单",
  fields: {
    region: { fieldId: "1475873629259637057", controlType: "select" },
    orderNo: { fieldId: "4742314689772812364", controlType: "text" },
    contractPartner: { fieldId: "4742314689772812365", controlType: "text" },
    endUser: { fieldId: "4742314689772812366", controlType: "text" },
    productType: { fieldId: "1297557904233988097", controlType: "checkbox" },
    purchaseContent: { fieldId: "4742314689772812367", controlType: "textarea" },
    purchaseAttachment: { fieldId: "4742314795739512449", controlType: "file" },
    quoteAttachment: { fieldId: "1150265436892569601", controlType: "file" },
  },
};

function 创建订单预审配置() {
  return 读取应用配置({
    APP_ENV: "test",
    ORDER_PREAPPROVAL_WORKER_ENABLED: "true",
    ORDER_PREAPPROVAL_EVENT_CUTOVER_AT: "2026-08-27T00:00:00.000Z",
    ORDER_PREAPPROVAL_ETEAMS_ORIGIN: "https://oa.example.com",
    ORDER_PREAPPROVAL_ETEAMS_CORP_ID: "test-corp",
    ORDER_PREAPPROVAL_ETEAMS_APP_KEY: "test-app-key",
    ORDER_PREAPPROVAL_ETEAMS_APP_SECRET: "test-app-secret-value",
    MESSAGE_CHANNEL_CONFIG_ENCRYPTION_KEY: "MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI=",
  });
}

describe("订单预审外部集成", () => {
  it("领取订单预审发件箱事件时保持 UUID 字段类型一致", () => {
    expect(订单预审事件领取查询).toContain("request.id=event.aggregate_id::uuid");
    expect(订单预审事件领取查询).toContain("candidate.request_id AS request_id");
  });

  it("订单预审任务默认关闭时不建立数据库连接或发送外部请求", async () => {
    const 服务 = await 启动订单预审任务服务(读取应用配置({ APP_ENV: "test" }));
    expect(服务.enabled).toBe(false);
    await expect(服务.close()).resolves.toBeUndefined();
  });

  it("报价单 PDF 使用中文标准字体并包含订单明细", () => {
    const PDF = 生成订单预审报价单PDF({
      订单编号: "LS-2026-0001",
      报价编号: "BJ-2026-0001",
      合同对方: "渠道商甲",
      最终用户: "客户乙",
      所属区域: "南区-湖南MBU",
      明细: [{ 名称: "终端管理许可", 数量: "100", 单价: "100.00", 金额: "10000.00" }],
      合计金额: "10000.00",
      生成时间: "2026-08-27T00:00:00.000Z",
    });

    expect(PDF.subarray(0, 8).toString("binary")).toBe("%PDF-1.7");
    expect(PDF.toString("binary")).toContain("/STSong-Light");
    expect(PDF.toString("binary")).toContain("xref");
  });

  it("创建载荷保持超长字段与附件编号精度，且附件作为主表字段提交", () => {
    const 载荷 = 序列化订单预审创建载荷({
      workflowId: "7412314682719324051",
      formId: "7412314682719324051",
      发起人泛微编号: "2143392393502329170",
      订单编号: "LS-2026-0001",
      合同对方: "渠道商甲",
      最终用户: "客户乙",
      所属区域: "南区-湖南MBU",
      字段映射,
      采购订单附件: { fileId: "1308244418466054167", fileName: "报价单.pdf" },
      报价单附件: { fileId: "1308244418466054168", fileName: "报价单.pdf" },
    });

    expect(载荷).toContain('"fieldId":4742314795739512449');
    expect(载荷).toContain('"optionId":1308244418466054167');
    expect(载荷).toContain('"fieldId":1150265436892569601');
    expect(载荷).toContain('"optionId":1308244418466054168');
    expect(载荷).toContain('"fieldId":"4742314689772812364","content":"LS-2026-0001"');
    expect(载荷).toContain('"fieldId":"4742314689772812365","content":"渠道商甲"');
    expect(载荷).toContain('"fieldId":"4742314689772812366","content":"客户乙"');
    expect(载荷).toContain('"fieldId":"4742314689772812367","content":"详见采购订单上传处的报价单"');
    expect(载荷).not.toContain('"fieldId":"4742314689772812364","dataOptions"');
    expect(载荷).not.toContain("dataIndex");
    expect(载荷).toContain('"isnextflow":1');
    expect(载荷).toContain('"isVerifyFormRequired":true');
  });

  it("泛微附件上传使用服务端授权、multipart 和发起人 userid", async () => {
    const 请求 = vi
      .fn()
      .mockResolvedValueOnce(new Response('{"code":"auth-code"}', { status: 200 }))
      .mockResolvedValueOnce(new Response('{"accessToken":"eteams-token"}', { status: 200 }))
      .mockResolvedValueOnce(
        new Response('{"message":{"errcode":"0","fileid":1308244418466054167}}', { status: 200 }),
      );
    const 客户端 = new 泛微订单预审客户端(创建订单预审配置().orderPreapproval, 请求);

    await expect(
      客户端.上传报价单("2143392393502329170", "报价单.pdf", Buffer.from("pdf-content")),
    ).resolves.toEqual({ fileId: "1308244418466054167", fileName: "报价单.pdf" });
    expect(String(请求.mock.calls[0]?.[0])).toContain("/oauth2/authorize");
    expect(String(请求.mock.calls[1]?.[0])).toContain("/oauth2/access_token");
    expect(String(请求.mock.calls[2]?.[0])).toContain("/api/file/v2/common/upload");
    const 表单 = 请求.mock.calls[2]?.[1]?.body;
    expect(表单).toBeInstanceOf(FormData);
    expect((表单 as FormData).get("userid")).toBe("2143392393502329170");
    expect((表单 as FormData).get("module")).toBe("workflow");
  });

  it("兼容泛微附件编号位于 data、result 及不同命名格式的响应", () => {
    expect(读取泛微附件编号({ data: { fileId: "1308244418466054167" } })).toBe(
      "1308244418466054167",
    );
    expect(读取泛微附件编号({ result: { id: "1308244418466054168" } })).toBe("1308244418466054168");
    expect(读取泛微附件编号({ message: { file_id: "1308244418466054169" } })).toBe(
      "1308244418466054169",
    );
    expect(读取泛微附件编号({ data: { fileId: "上传失败" } })).toBeUndefined();
  });

  it("泛微创建成功后会精确保留流程编号，并按已验证字段回查", async () => {
    const 请求 = vi
      .fn()
      .mockResolvedValueOnce(new Response('{"code":"auth-code"}', { status: 200 }))
      .mockResolvedValueOnce(new Response('{"accessToken":"eteams-token"}', { status: 200 }))
      .mockResolvedValueOnce(
        new Response('{"message":{"errcode":0,"requestId":1308244418466054167}}', { status: 200 }),
      )
      .mockResolvedValueOnce(new Response('{"code":"auth-code"}', { status: 200 }))
      .mockResolvedValueOnce(new Response('{"accessToken":"eteams-token"}', { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            message: { errcode: 0 },
            flowRequest: { statusType: "inProcess", currentNode: "梁婉琦审批" },
            formData: {
              dataDetails: {
                所属区域: "南区-湖南MBU",
                订单编号: "LS-2026-0001",
                合同对方: "渠道商甲",
                最终用户: "客户乙",
                产品类型: "EPP渠道产品",
                采购内容: "详见采购订单上传处的报价单",
                采购订单上传处: "报价单.pdf",
                "报价单/收益表上传处": "报价单.pdf",
              },
              fileDownload_Urls: { 采购订单上传处: "hidden", "报价单/收益表上传处": "hidden" },
            },
          }),
          { status: 200 },
        ),
      );
    const 客户端 = new 泛微订单预审客户端(创建订单预审配置().orderPreapproval, 请求);
    const 流程编号 = await 客户端.创建并流转流程({
      workflowId: "7412314682719324051",
      formId: "7412314682719324051",
      发起人泛微编号: "2143392393502329170",
      订单编号: "LS-2026-0001",
      合同对方: "渠道商甲",
      最终用户: "客户乙",
      所属区域: "南区-湖南MBU",
      字段映射,
      采购订单附件: { fileId: "1308244418466054167", fileName: "报价单.pdf" },
      报价单附件: { fileId: "1308244418466054168", fileName: "报价单.pdf" },
    });

    expect(流程编号).toBe("1308244418466054167");
    await expect(
      客户端.回查流程("2143392393502329170", 流程编号, {
        订单编号: "LS-2026-0001",
        所属区域: "南区-湖南MBU",
        产品类型: "EPP渠道产品",
        采购内容: "详见采购订单上传处的报价单",
      }),
    ).resolves.toBeUndefined();
    expect(String(请求.mock.calls[2]?.[0])).toContain("/doCreateRequest");
    expect(String(请求.mock.calls[5]?.[0])).toContain("/workflow/v2/getInfoByID");
  });

  it("泛微创建结果不确定时转人工确认，不允许任务自动重发", async () => {
    const 请求 = vi
      .fn()
      .mockResolvedValueOnce(new Response('{"code":"auth-code"}', { status: 200 }))
      .mockResolvedValueOnce(new Response('{"accessToken":"eteams-token"}', { status: 200 }))
      .mockRejectedValueOnce(new DOMException("超时", "AbortError"));
    const 客户端 = new 泛微订单预审客户端(创建订单预审配置().orderPreapproval, 请求);

    await expect(
      客户端.创建并流转流程({
        workflowId: "7412314682719324051",
        formId: "7412314682719324051",
        发起人泛微编号: "2143392393502329170",
        订单编号: "LS-2026-0001",
        合同对方: "渠道商甲",
        最终用户: "客户乙",
        所属区域: "南区-湖南MBU",
        字段映射,
        采购订单附件: { fileId: "1308244418466054167", fileName: "报价单.pdf" },
        报价单附件: { fileId: "1308244418466054168", fileName: "报价单.pdf" },
      }),
    ).rejects.toMatchObject({
      code: "ETEAMS_CREATE_RESULT_UNCERTAIN",
      manualConfirmationRequired: true,
      retryable: false,
    });
  });

  it("泛微业务拒绝时保留脱敏错误提示", async () => {
    const 请求 = vi
      .fn()
      .mockResolvedValueOnce(new Response('{"code":"auth-code"}', { status: 200 }))
      .mockResolvedValueOnce(new Response('{"accessToken":"eteams-token"}', { status: 200 }))
      .mockResolvedValueOnce(
        new Response('{"message":{"errcode":1200306,"errmsg":"流程无权限或模板不可用"}}', {
          status: 200,
        }),
      );
    const 客户端 = new 泛微订单预审客户端(创建订单预审配置().orderPreapproval, 请求);

    await expect(
      客户端.创建并流转流程({
        workflowId: "7412314682719324051",
        formId: "7412314682719324051",
        发起人泛微编号: "2143392393502329170",
        订单编号: "LS-2026-0001",
        合同对方: "渠道商甲",
        最终用户: "客户乙",
        所属区域: "南区-湖南MBU",
        字段映射,
        采购订单附件: { fileId: "1308244418466054167", fileName: "报价单.pdf" },
        报价单附件: { fileId: "1308244418466054168", fileName: "报价单.pdf" },
      }),
    ).rejects.toMatchObject({
      code: "ETEAMS_1200306",
      responseSummary: { message: "流程无权限或模板不可用" },
    });
  });

  it("企微建群使用固定群编号创建并发送最小通知", async () => {
    const 请求 = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('{"errcode":0,"access_token":"wecom-token","expires_in":7200}', {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(new Response('{"errcode":0,"chatid":"op_test"}', { status: 200 }))
      .mockResolvedValueOnce(new Response('{"errcode":0}', { status: 200 }));
    const 客户端 = new 企微订单预审群客户端(
      { corpId: "ww-test-corp", secret: "test-wecom-secret" },
      5_000,
      请求,
    );
    await expect(
      客户端.创建群({
        群编号: "op_test",
        群名称: "订单预审-LS-2026-0001",
        群主企微编号: "liangguangyao",
        成员企微编号: ["quguan", "liangwanqi", "liangguangyao", "shoulong", "liulonghai"],
      }),
    ).resolves.toBe("op_test");
    await expect(客户端.发送群通知("op_test")).resolves.toBeUndefined();
    expect(String(请求.mock.calls[1]?.[0])).toContain("/cgi-bin/appchat/create");
    expect(String(请求.mock.calls[2]?.[0])).toContain("/cgi-bin/appchat/send");
    expect(String(请求.mock.calls[2]?.[1]?.body)).not.toContain("客户");
  });

  it("企微建群出现服务端异常时转人工确认，禁止自动创建第二个群", async () => {
    const 请求 = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('{"errcode":0,"access_token":"wecom-token-uncertain","expires_in":7200}', {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(new Response('{"errcode":45011}', { status: 503 }));
    const 客户端 = new 企微订单预审群客户端(
      { corpId: "ww-test-corp-uncertain", secret: "test-wecom-secret-uncertain" },
      5_000,
      请求,
    );

    await expect(
      客户端.创建群({
        群编号: "op_uncertain",
        群名称: "订单预审-LS-2026-0002",
        群主企微编号: "liangguangyao",
        成员企微编号: ["quguan", "liangwanqi", "liangguangyao", "shoulong", "liulonghai"],
      }),
    ).rejects.toMatchObject({
      code: "WECOM_GROUP_CREATE_RESULT_UNCERTAIN",
      manualConfirmationRequired: true,
      retryable: false,
    });
  });
});
