"use client";

import { useState, useEffect } from "react";

type GeneratorMode = "REPLACE" | "MIGRATE";

interface ExtraFilter {
  id: string;
  field: string;
  value: string;
}

interface FieldConfig {
  id: string;
  dbName: string;
  tableName: string;
  fieldName: string; // Used in SET
  selected: boolean;
  // Advanced Subquery Filter (for REPLACE mode WHERE clause)
  useParentFilter: boolean;
  parentDbName: string;
  parentTableName: string;
  parentSearchField: string;
  parentSearchValue: string;
  parentResultField: string;
  targetLinkField: string;
  // Migration Specific
  migrationTargetSearchField: string; // Used in WHERE
  migrationSourceDb: string;
  migrationSourceTable: string;
  migrationSourceSearchField: string;
  migrationSourceResultField: string;
  extraFilters: ExtraFilter[]; // Target filters
  sourceExtraFilters: ExtraFilter[]; // New: Source (subquery) filters
}

interface Replacement {
  id: string;
  oldValue: string;
  newValue: string;
}

const DEFAULT_CONFIGS: FieldConfig[] = [
  { 
    id: "1", dbName: "", tableName: "", fieldName: "", selected: true,
    useParentFilter: false, parentDbName: "", parentTableName: "", parentSearchField: "", parentSearchValue: "", parentResultField: "", targetLinkField: "",
    migrationTargetSearchField: "",
    migrationSourceDb: "", migrationSourceTable: "", migrationSourceSearchField: "", migrationSourceResultField: "",
    extraFilters: [],
    sourceExtraFilters: []
  }
];

export default function SqlGenerator() {
  const [mode, setMode] = useState<GeneratorMode>("REPLACE");
  const [configs, setConfigs] = useState<FieldConfig[]>(DEFAULT_CONFIGS);
  const [replacements, setReplacements] = useState<Replacement[]>([
    { id: "r1", oldValue: "", newValue: "" }
  ]);
  const [generatedSql, setGeneratedSql] = useState("");
  const [copyStatus, setCopyStatus] = useState("复制 SQL");
  const [showAdvancedId, setShowAdvancedId] = useState<string | null>(null);

  // Load from localStorage on mount - Version v12
  useEffect(() => {
    const savedConfigs = localStorage.getItem("sql_generator_configs_v12");
    if (savedConfigs) {
      try {
        setConfigs(JSON.parse(savedConfigs));
      } catch (e) {
        console.error("Failed to parse saved configs", e);
      }
    }
  }, []);

  // Save to localStorage when configs change
  useEffect(() => {
    localStorage.setItem("sql_generator_configs_v12", JSON.stringify(configs));
  }, [configs]);

  const addConfig = () => {
    const newConfig: FieldConfig = {
      id: Date.now().toString(),
      dbName: "",
      tableName: "",
      fieldName: "",
      selected: true,
      useParentFilter: false,
      parentDbName: "",
      parentTableName: "",
      parentSearchField: "",
      parentSearchValue: "",
      parentResultField: "",
      targetLinkField: "",
      migrationTargetSearchField: "",
      migrationSourceDb: "",
      migrationSourceTable: "",
      migrationSourceSearchField: "",
      migrationSourceResultField: "",
      extraFilters: [],
      sourceExtraFilters: []
    };
    setConfigs([...configs, newConfig]);
  };

  const removeConfig = (id: string) => {
    setConfigs(configs.filter(c => c.id !== id));
  };

  const updateConfig = (id: string, updates: Partial<FieldConfig>) => {
    setConfigs(configs.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const addReplacement = () => {
    setReplacements([...replacements, { id: Date.now().toString(), oldValue: "", newValue: "" }]);
  };

  const removeReplacement = (id: string) => {
    setReplacements(replacements.filter(r => r.id !== id));
  };

  const updateReplacement = (id: string, updates: Partial<Replacement>) => {
    setReplacements(replacements.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const addExtraFilter = (configId: string, type: 'target' | 'source') => {
    const config = configs.find(c => c.id === configId);
    if (!config) return;
    const newFilter: ExtraFilter = { id: Date.now().toString(), field: "", value: "" };
    if (type === 'target') {
      updateConfig(configId, { extraFilters: [...(config.extraFilters || []), newFilter] });
    } else {
      updateConfig(configId, { sourceExtraFilters: [...(config.sourceExtraFilters || []), newFilter] });
    }
  };

  const removeExtraFilter = (configId: string, filterId: string, type: 'target' | 'source') => {
    const config = configs.find(c => c.id === configId);
    if (!config) return;
    if (type === 'target') {
      updateConfig(configId, { extraFilters: config.extraFilters.filter(f => f.id !== filterId) });
    } else {
      updateConfig(configId, { sourceExtraFilters: config.sourceExtraFilters.filter(f => f.id !== filterId) });
    }
  };

  const updateExtraFilter = (configId: string, filterId: string, updates: Partial<ExtraFilter>, type: 'target' | 'source') => {
    const config = configs.find(c => c.id === configId);
    if (!config) return;
    if (type === 'target') {
      updateConfig(configId, {
        extraFilters: config.extraFilters.map(f => f.id === filterId ? { ...f, ...updates } : f)
      });
    } else {
      updateConfig(configId, {
        sourceExtraFilters: config.sourceExtraFilters.map(f => f.id === filterId ? { ...f, ...updates } : f)
      });
    }
  };

  const formatTableName = (db: string, table: string) => {
    if (!table) return "";
    return db ? `\`${db}\`.\`${table}\`` : `\`${table}\``;
  };

  const buildWhereCondition = (config: FieldConfig, targetSearchValue: string) => {
    let parts = [`\`${config.migrationTargetSearchField}\` LIKE '%${targetSearchValue}%'`];
    if (config.extraFilters && config.extraFilters.length > 0) {
      config.extraFilters.forEach(f => {
        if (f.field && f.value) parts.push(`\`${f.field}\` LIKE '%${f.value}%'`);
      });
    }
    return parts.join("\n  AND ");
  };

  const buildSourceSubquery = (config: FieldConfig, sourceSearchValue: string) => {
    const { migrationSourceDb, dbName, migrationSourceTable, tableName, migrationSourceResultField, migrationSourceSearchField, sourceExtraFilters } = config;
    const fullSourceTable = formatTableName(migrationSourceDb || dbName, migrationSourceTable || tableName);
    const fullTargetTable = formatTableName(dbName, tableName);

    // Safety wrap if same table
    const isSameTable = fullTargetTable === fullSourceTable;
    const tableSource = isSameTable ? `(SELECT * FROM ${fullSourceTable}) AS tmp_sub` : fullSourceTable;

    let parts = [`\`${migrationSourceSearchField}\` LIKE '%${sourceSearchValue}%'`];
    if (sourceExtraFilters && sourceExtraFilters.length > 0) {
      sourceExtraFilters.forEach(f => {
        if (f.field && f.value) parts.push(`\`${f.field}\` LIKE '%${f.value}%'`);
      });
    }

    return `(SELECT \`${migrationSourceResultField}\` FROM ${tableSource} WHERE ${parts.join(" AND ")} LIMIT 1)`;
  };

  const generateUpdateSql = () => {
    const activeReplacements = replacements.filter(r => r.oldValue.trim() !== "");
    const activeConfigs = configs.filter(c => c.selected && c.tableName.trim() !== "" && c.fieldName.trim() !== "");

    if (activeReplacements.length === 0 || activeConfigs.length === 0) {
      setGeneratedSql("-- 请先添加替换规则和选择字段");
      return;
    }

    let sql = "";
    activeConfigs.forEach((config, idx) => {
      const { dbName, tableName, fieldName } = config;
      const fullTableName = formatTableName(dbName, tableName);
      sql += `-- [任务 ${idx + 1}] 更新 ${fullTableName}.${fieldName}\n`;

      let whereCondition = activeReplacements.map(r => `\`${fieldName}\` LIKE '%${r.oldValue}%'`).join("\n   OR ");
      
      if (config.useParentFilter && config.parentSearchValue) {
        const pDb = config.parentDbName || dbName;
        const pTable = config.parentTableName || tableName;
        const fullParentTable = formatTableName(pDb, pTable);
        const isSameTable = (pDb === dbName) && (pTable === tableName);
        const tableSource = isSameTable ? `(SELECT * FROM ${fullParentTable}) AS tmp_sub` : fullParentTable;
        const subquery = `(SELECT \`${config.parentResultField}\` FROM ${tableSource} WHERE \`${config.parentSearchField}\` LIKE '%${config.parentSearchValue}%' LIMIT 1)`;
        whereCondition = `\`${config.targetLinkField}\` = ${subquery}\n  AND (${activeReplacements.length > 1 ? '\n  ' : ''}${activeReplacements.map(r => `\`${fieldName}\` LIKE '%${r.oldValue}%'`).join("\n   OR ")}${activeReplacements.length > 1 ? '\n  ' : ''})`;
      }

      if (activeReplacements.length === 1) {
        const { oldValue, newValue } = activeReplacements[0];
        sql += `UPDATE ${fullTableName} \nSET \`${fieldName}\` = REPLACE(\`${fieldName}\`, '${oldValue}', '${newValue}') \nWHERE ${whereCondition};\n\n`;
      } else {
        sql += `UPDATE ${fullTableName} \nSET \`${fieldName}\` = CASE\n`;
        activeReplacements.forEach(r => {
          sql += `    WHEN \`${fieldName}\` LIKE '%${r.oldValue}%' THEN REPLACE(\`${fieldName}\`, '${r.oldValue}', '${r.newValue}')\n`;
        });
        sql += `    ELSE \`${fieldName}\`\nEND\nWHERE ${whereCondition};\n\n`;
      }
    });

    setGeneratedSql(sql.trim());
  };

  const generateQuerySql = () => {
    const activeReplacements = replacements.filter(r => r.oldValue.trim() !== "");
    const activeConfigs = configs.filter(c => c.selected && c.tableName.trim() !== "" && c.fieldName.trim() !== "");

    if (activeConfigs.length === 0) {
      setGeneratedSql("-- 请先选择要查询的字段");
      return;
    }

    let sql = "";
    activeConfigs.forEach((config, idx) => {
      const { dbName, tableName, fieldName } = config;
      const fullTableName = formatTableName(dbName, tableName);
      sql += `-- [查询 ${idx + 1}] 检索 ${fullTableName}.${fieldName}\n`;

      let whereCondition = "";
      if (activeReplacements.length > 0) {
        whereCondition = activeReplacements.map(r => `\`${fieldName}\` LIKE '%${r.oldValue}%'`).join("\n   OR ");
      } else {
        whereCondition = `\`${fieldName}\` IS NOT NULL`;
      }
      
      if (config.useParentFilter && config.parentSearchValue) {
        const pDb = config.parentDbName || dbName;
        const pTable = config.parentTableName || tableName;
        const fullParentTable = formatTableName(pDb, pTable);
        const subquery = `(SELECT \`${config.parentResultField}\` FROM ${fullParentTable} WHERE \`${config.parentSearchField}\` LIKE '%${config.parentSearchValue}%' LIMIT 1)`;
        whereCondition = `\`${config.targetLinkField}\` = ${subquery}\n  AND (${activeReplacements.length > 1 ? '\n  ' : ''}${whereCondition}${activeReplacements.length > 1 ? '\n  ' : ''})`;
      }

      sql += `SELECT * FROM ${fullTableName} \nWHERE ${whereCondition};\n\n`;
    });

    setGeneratedSql(sql.trim());
  };

  const generateMigrationSql = () => {
    const activeReplacements = replacements.filter(r => r.oldValue.trim() !== "" && r.newValue.trim() !== "");
    const activeConfigs = configs.filter(c => c.selected && c.tableName.trim() !== "");

    if (activeReplacements.length === 0 || activeConfigs.length === 0) {
      setGeneratedSql("-- 请先添加映射规则并配置字段");
      return;
    }

    let sql = "";
    activeConfigs.forEach((config, idx) => {
      const { dbName, tableName, fieldName } = config;
      const fullTargetTable = formatTableName(dbName, tableName);
      sql += `-- [关系迁移 ${idx + 1}] 更新 ${fullTargetTable}.${fieldName}\n`;

      activeReplacements.forEach(pair => {
        const subquery = buildSourceSubquery(config, pair.newValue);
        const whereClause = buildWhereCondition(config, pair.oldValue);
        sql += `UPDATE ${fullTargetTable} \nSET \`${fieldName}\` = ${subquery} \nWHERE ${whereClause};\n\n`;
      });
    });

    setGeneratedSql(sql.trim());
  };

  const generateMigrationVerifySql = () => {
    const activeReplacements = replacements.filter(r => r.oldValue.trim() !== "" && r.newValue.trim() !== "");
    const activeConfigs = configs.filter(c => c.selected && c.tableName.trim() !== "");

    if (activeReplacements.length === 0 || activeConfigs.length === 0) {
      setGeneratedSql("-- 请先添加映射规则");
      return;
    }

    let sql = "";
    activeConfigs.forEach((config, idx) => {
      const { dbName, tableName, migrationSourceDb, migrationSourceTable, migrationSourceSearchField, sourceExtraFilters } = config;
      const fullTargetTable = formatTableName(dbName, tableName);
      const fullSourceTable = formatTableName(migrationSourceDb || dbName, migrationSourceTable || tableName);

      sql += `-- [校验查询 ${idx + 1}] 验证数据\n`;
      
      activeReplacements.forEach(pair => {
        const whereClause = buildWhereCondition(config, pair.oldValue);
        let sParts = [`\`${migrationSourceSearchField}\` LIKE '%${pair.newValue}%'`];
        if (sourceExtraFilters?.length > 0) {
           sourceExtraFilters.forEach(f => { if(f.field && f.value) sParts.push(`\`${f.field}\` LIKE '%${f.value}%'`); });
        }
        
        sql += `-- 映射: ${pair.oldValue} -> ${pair.newValue}\n`;
        sql += `SELECT * FROM ${fullTargetTable} WHERE ${whereClause};\n`;
        sql += `SELECT * FROM ${fullSourceTable} WHERE ${sParts.join(" AND ")};\n\n`;
      });
    });

    setGeneratedSql(sql.trim());
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedSql);
    setCopyStatus("已复制！");
    setTimeout(() => setCopyStatus("复制 SQL"), 2000);
  };

  return (
    <div className="fade-in">
      <div className="page-hero">
        <div className="hero-content">
          <div className="page-kicker">DATABASE UTILITY</div>
          <h1 className="page-title">SQL 批量生成器</h1>
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
             <button className={`btn ${mode === 'REPLACE' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setMode('REPLACE')} style={{ minHeight: '38px', fontSize: '0.85rem' }}>内容替换模式</button>
            <button className={`btn ${mode === 'MIGRATE' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setMode('MIGRATE')} style={{ minHeight: '38px', fontSize: '0.85rem' }}>关系迁移模式</button>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
        <section className="glass-panel section-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>1. 配置目标库表与字段</h3>
            <button className="btn btn-secondary btn-icon" onClick={addConfig}>+</button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {configs.map((config) => (
              <div key={config.id} className="surface-panel" style={{ padding: '16px', borderRadius: '18px', border: '1px solid var(--border-subtle)', background: config.selected ? 'rgba(22, 119, 255, 0.02)' : 'transparent' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: showAdvancedId === config.id ? '16px' : '0' }}>
                  <input type="checkbox" checked={config.selected ?? true} onChange={(e) => updateConfig(config.id, { selected: e.target.checked })} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                  <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '0.8fr 1.2fr 1.2fr', gap: '8px' }}>
                    <input className="field-control" placeholder="库名" value={config.dbName || ""} onChange={(e) => updateConfig(config.id, { dbName: e.target.value })} />
                    <input className="field-control" placeholder="表名" value={config.tableName || ""} onChange={(e) => updateConfig(config.id, { tableName: e.target.value })} />
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', top: '-14px', left: '4px', fontSize: '10px', color: 'var(--brand)', fontWeight: 700 }}>{mode === 'MIGRATE' ? 'SET (待更新字段)' : 'FIELD'}</span>
                      <input className="field-control" placeholder={mode === 'REPLACE' ? "待替换字段" : "待更新字段"} value={config.fieldName || ""} onChange={(e) => updateConfig(config.id, { fieldName: e.target.value })} />
                    </div>
                  </div>
                  <button className={`btn btn-icon ${showAdvancedId === config.id ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setShowAdvancedId(showAdvancedId === config.id ? null : config.id)}>⚙️</button>
                  <button className="btn btn-ghost btn-icon" style={{ color: 'var(--danger)', borderColor: 'transparent' }} onClick={() => removeConfig(config.id)}>✕</button>
                </div>

                {showAdvancedId === config.id && (
                  <div className="fade-in" style={{ padding: '14px', background: 'rgba(15, 23, 42, 0.03)', borderRadius: '12px', marginTop: '8px', border: '1px dashed var(--border-strong)' }}>
                    {mode === 'REPLACE' ? (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                          <input type="checkbox" checked={config.useParentFilter ?? false} onChange={(e) => updateConfig(config.id, { useParentFilter: e.target.checked })} />
                          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--brand)' }}>启用父级关联过滤</label>
                        </div>
                        {config.useParentFilter && (
                           <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                             <input className="field-control" placeholder="父库名" value={config.parentDbName || ""} onChange={(e) => updateConfig(config.id, { parentDbName: e.target.value })} />
                             <input className="field-control" placeholder="父表名" value={config.parentTableName || ""} onChange={(e) => updateConfig(config.id, { parentTableName: e.target.value })} />
                             <input className="field-control" placeholder="搜索字段" value={config.parentSearchField || ""} onChange={(e) => updateConfig(config.id, { parentSearchField: e.target.value })} />
                             <input className="field-control" placeholder="搜索名称" value={config.parentSearchValue || ""} onChange={(e) => updateConfig(config.id, { parentSearchValue: e.target.value })} />
                             <input className="field-control" placeholder="本表关联字段" value={config.targetLinkField || ""} onChange={(e) => updateConfig(config.id, { targetLinkField: e.target.value })} />
                             <input className="field-control" placeholder="父表返回字段" value={config.parentResultField || ""} onChange={(e) => updateConfig(config.id, { parentResultField: e.target.value })} />
                           </div>
                        )}
                      </>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* Target Filter Section */}
                        <div style={{ padding: '12px', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '10px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                          <label style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '8px', display: 'block', color: '#1d4ed8' }}>1. WHERE 条件定位 (本表搜索)</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                            <span style={{ fontWeight: 800, color: '#1d4ed8' }}>WHERE</span>
                            <input className="field-control" style={{ fontWeight: 700, color: '#1d4ed8' }} placeholder="主搜索字段" value={config.migrationTargetSearchField || ""} onChange={(e) => updateConfig(config.id, { migrationTargetSearchField: e.target.value })} />
                          </div>
                          
                          {/* Target Extra Filters */}
                          <div style={{ borderTop: '1px solid rgba(59, 130, 246, 0.1)', paddingTop: '10px' }}>
                             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                               <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#1d4ed8' }}>本表附加 LIKE 过滤</span>
                               <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: '10px' }} onClick={() => addExtraFilter(config.id, 'target')}>+ 添加条件</button>
                             </div>
                             <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                               {config.extraFilters?.map(f => (
                                 <div key={f.id} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                   <span style={{ fontSize: '10px', fontWeight: 800, color: '#1d4ed8' }}>AND</span>
                                   <input className="field-control" style={{ fontSize: '12px', minHeight: '32px' }} placeholder="字段名" value={f.field} onChange={(e) => updateExtraFilter(config.id, f.id, { field: e.target.value }, 'target')} />
                                   <span style={{ fontSize: '10px', fontWeight: 800, color: '#1d4ed8' }}>LIKE</span>
                                   <input className="field-control" style={{ fontSize: '12px', minHeight: '32px' }} placeholder="值" value={f.value} onChange={(e) => updateExtraFilter(config.id, f.id, { value: e.target.value }, 'target')} />
                                   <button className="btn btn-ghost" style={{ padding: '2px 6px', color: 'var(--danger)' }} onClick={() => removeExtraFilter(config.id, f.id, 'target')}>✕</button>
                                 </div>
                               ))}
                             </div>
                          </div>
                        </div>
                        
                        {/* Source Filter Section */}
                        <div style={{ padding: '12px', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                          <label style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '8px', display: 'block', color: '#059669' }}>2. 迁移源配置 (查找新 ID)</label>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                            <input className="field-control" placeholder="源库名" value={config.migrationSourceDb || ""} onChange={(e) => updateConfig(config.id, { migrationSourceDb: e.target.value })} />
                            <input className="field-control" placeholder="源表名" value={config.migrationSourceTable || ""} onChange={(e) => updateConfig(config.id, { migrationSourceTable: e.target.value })} />
                            <input className="field-control" placeholder="主搜索字段 (如: name)" value={config.migrationSourceSearchField || ""} onChange={(e) => updateConfig(config.id, { migrationSourceSearchField: e.target.value })} />
                            <input className="field-control" placeholder="获取字段 (如: id)" value={config.migrationSourceResultField || ""} onChange={(e) => updateConfig(config.id, { migrationSourceResultField: e.target.value })} />
                          </div>

                          {/* Source Extra Filters */}
                          <div style={{ borderTop: '1px solid rgba(16, 185, 129, 0.1)', paddingTop: '10px' }}>
                             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                               <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#059669' }}>来源表附加 LIKE 过滤</span>
                               <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: '10px', color: '#059669' }} onClick={() => addExtraFilter(config.id, 'source')}>+ 添加条件</button>
                             </div>
                             <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                               {config.sourceExtraFilters?.map(f => (
                                 <div key={f.id} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                   <span style={{ fontSize: '10px', fontWeight: 800, color: '#059669' }}>AND</span>
                                   <input className="field-control" style={{ fontSize: '12px', minHeight: '32px' }} placeholder="字段名" value={f.field} onChange={(e) => updateExtraFilter(config.id, f.id, { field: e.target.value }, 'source')} />
                                   <span style={{ fontSize: '10px', fontWeight: 800, color: '#059669' }}>LIKE</span>
                                   <input className="field-control" style={{ fontSize: '12px', minHeight: '32px' }} placeholder="值" value={f.value} onChange={(e) => updateExtraFilter(config.id, f.id, { value: e.target.value }, 'source')} />
                                   <button className="btn btn-ghost" style={{ padding: '2px 6px', color: 'var(--danger)' }} onClick={() => removeExtraFilter(config.id, f.id, 'source')}>✕</button>
                                 </div>
                               ))}
                             </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="glass-panel section-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>{mode === 'REPLACE' ? '2. 定义替换规则' : '2. 映射关系 '}</h3>
            <button className="btn btn-secondary btn-icon" onClick={addReplacement}>+</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {replacements.map((r) => (
              <div key={r.id} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '8px', alignItems: 'center' }}>
                  <input className="field-control" placeholder={mode === 'REPLACE' ? "旧值" : "旧值"} value={r.oldValue || ""} onChange={(e) => updateReplacement(r.id, { oldValue: e.target.value })} />
                  <span style={{ color: 'var(--text-faint)', fontWeight: 800 }}>→</span>
                  <input className="field-control" placeholder={mode === 'REPLACE' ? "新值" : "新值"} value={r.newValue || ""} onChange={(e) => updateReplacement(r.id, { newValue: e.target.value })} />
                </div>
                <button className="btn btn-ghost btn-icon" style={{ color: 'var(--danger)', borderColor: 'transparent' }} onClick={() => removeReplacement(r.id)}>✕</button>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '32px' }}>
            {mode === 'REPLACE' ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <button className="btn btn-primary" onClick={generateUpdateSql}>🚀 生成 UPDATE</button>
                <button className="btn btn-secondary" onClick={generateQuerySql}>🔍 生成 SELECT</button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '12px' }}>
                <button className="btn btn-primary" style={{ height: '54px' }} onClick={generateMigrationSql}>🚚 生成关系迁移 SQL</button>
                <button className="btn btn-secondary" style={{ height: '54px' }} onClick={generateMigrationVerifySql}>🔍 生成校验查询</button>
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="glass-panel section-card" style={{ marginTop: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>3. 生成结果</h3>
          {generatedSql && <button className="btn btn-success" onClick={copyToClipboard}>{copyStatus}</button>}
        </div>
        <textarea className="field-control field-control--textarea" style={{ fontFamily: 'monospace', fontSize: '13px', background: '#1e293b', color: '#e2e8f0', minHeight: '400px' }} readOnly value={generatedSql} placeholder="生成的 SQL 将显示在这里..." />
      </section>
    </div>
  );
}
