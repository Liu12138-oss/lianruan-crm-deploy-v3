/*
 * EMM H5 单点登录桥接。
 * 仅实现当前登录需要的 getSSOToken，调用方式与对方 EMM-H5 子应用 JS 集成文档一致。
 */
(function (window, document) {
  'use strict';

  if (window.JQAPI && typeof window.JQAPI.getSSOToken === 'function') return;

  function toParamText(param) {
    if (!param) return '';
    if (typeof param === 'string') return param;
    return JSON.stringify(param);
  }

  function executeEmmApi(invokeID, apiName, param, successCallBackName, failedCallBackName) {
    const src = 'emm-services://?action=jsfunction'
      + `&invokeID=${encodeURIComponent(invokeID || '')}`
      + `&apiname=${encodeURIComponent(apiName || '')}`
      + `&param=${encodeURIComponent(toParamText(param))}`
      + `&oncallback=${encodeURIComponent(successCallBackName || '')}`
      + `&errorcallback=${encodeURIComponent(failedCallBackName || '')}`;

    const element = document.createElement('iframe');
    element.setAttribute('src', src);
    element.setAttribute('style', 'display:none');
    element.setAttribute('width', '0');
    element.setAttribute('height', '0');
    element.setAttribute('frameborder', '0');
    document.body.appendChild(element);
    element.parentNode.removeChild(element);
  }

  window.JQAPICallBack = window.JQAPICallBack || {
    callBackObjects: {},
    successCallBack(invokeID, data) {
      const item = this.callBackObjects[invokeID];
      if (!item) return;
      item.successCallBack(data);
      delete this.callBackObjects[invokeID];
    },
    failedCallBack(invokeID, data) {
      const item = this.callBackObjects[invokeID];
      if (!item) return;
      item.failedCallBack(data);
      delete this.callBackObjects[invokeID];
    }
  };

  function JQAPIFactory(invokeID, apiName, param, successCallBack, failedCallBack) {
    if (typeof successCallBack !== 'function' || typeof failedCallBack !== 'function') {
      throw new Error('回调参数必须是函数');
    }
    this.successCallBack = successCallBack;
    this.failedCallBack = failedCallBack;
    executeEmmApi(invokeID, apiName, param, 'JQAPICallBack.successCallBack', 'JQAPICallBack.failedCallBack');
  }

  window.JQAPI = {
    getSSOToken(param, successCallBack, failedCallBack) {
      const invokeID = `getSSOToken${Date.now()}${Math.random().toString(16).slice(2)}`;
      window.JQAPICallBack.callBackObjects[invokeID] = new JQAPIFactory(
        invokeID,
        'getSSOToken',
        param,
        successCallBack,
        failedCallBack
      );
    }
  };
})(window, document);
