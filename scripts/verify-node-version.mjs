const major = Number(process.versions.node.split(".")[0]);
if (major !== 22) {
  console.error("当前Node版本为 " + process.version + "，阶段1要求Node 22长期支持版。");
  process.exit(1);
}
console.log("Node版本检查通过：" + process.version);
