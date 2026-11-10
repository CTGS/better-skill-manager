window.__ModuleLoader__.load({
  id: 'better-skill-manager',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useCallback, useEffect, useMemo, useRef, useState } = React;

    /** react-dom is a platform module; keep an inline fallback for safety. */
    let createPortal = null;
    try {
      const reactDom = require('react-dom');
      if (reactDom && typeof reactDom.createPortal === 'function') createPortal = reactDom.createPortal;
    } catch {
      createPortal = null;
    }

    const NS = 'skillHub';
    const PLUGIN_ID = 'better-skill-manager';
    const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    const FILE_ADDRESS_PREFIX = 'dsh-resource://file/';
    const MAX_TAGS = 12;
    const MAX_TAG_LENGTH = 24;
    const RESERVED_TAGS = new Set(['内置', '用户', '其他途径来源', 'Other source']);
    let draftSeq = 0;

    const zh = {
      button: '技能',
      buttonTitle: 'BetterSkillManager：配置当前工作区会话的 Skill',
      title: 'BetterSkillManager',
      tabSession: '当前工作区会话',
      tabUser: '用户级',
      search: '搜索 Skill',
      tags: '标签筛选',
      clearFilters: '清除筛选',
      loading: '正在加载…',
      empty: '没有可用的 Skill',
      emptyUser: '还没有用户级 Skill',
      filterEmpty: '没有匹配的 Skill',
      error: '加载失败',
      retry: '重试',
      refresh: '刷新',
      close: '关闭',
      use: '使用',
      view: '查看',
      edit: '编辑',
      delete: '删除',
      save: '保存',
      saving: '保存中…',
      cancel: '取消',
      confirmDelete: '确认删除这个 Skill？',
      confirmDeleteHint: '删除后无法恢复。',
      saved: '已保存',
      imported: '已导入',
      deleted: '已删除',
      savedRefreshFailed: '已写入，但目录刷新失败，请点刷新',
      savedNotSynced: '文件已写入，目录尚未更新，请点刷新',
      loadFailed: '读取技能文件失败',
      retryLoad: '重新读取',
      multipleSkills: '文件夹里有多个 Skill，请只拖入一个技能目录',
      insertFailed: '当前输入框不可编辑，无法插入 Skill',
      hostUnavailable: '宿主命令不可用，无法保存',
      name: '名称',
      content: '文件内容',
      nameHint: '小写字母、数字和连字符',
      nameRequired: '名称需为小写 kebab-case',
      editTitle: '编辑 Skill',
      sectionName: '名称',
      sectionTags: '标签',
      sectionScope: '作用范围',
      sectionContent: '文件内容',
      scopeSession: '当前工作区会话',
      scopeSessionHint: '仅当前工作区内的会话可用',
      scopeUser: '用户级',
      scopeUserHint: '所有会话可用',
      scopeUnavailable: '当前工作区没有可用目录，暂时只能放到用户级',
      scopeMoveHint: '保存时会移动文件位置',
      nameChangedHint: '改名会同时更新 frontmatter 中的 name',
      noTags: '还没有标签',
      addTag: '添加',
      addTagHint: '输入标签后回车',
      removeTag: '移除标签',
      suggestedTags: '常用标签',
      tagHint: '标签会写入 SKILL.md 的 frontmatter',
      sourceProject: '项目',
      sourceUser: '用户',
      sourceBundled: '内置',
      sourceOther: '其他',
      userOnly: '仅用户',
      count: '共 {n} 个',
      readOnlyHint: '完整文件内容（含 YAML frontmatter）。保存时名称与标签会由上方模块同步写入。',
      addSkill: '添加',
      back: '返回',
      importTitle: '添加 Skill',
      importSource: 'Skill 文件',
      dropTitle: '拖入 SKILL.md 或技能文件夹',
      chooseFile: '从硬盘选择',
      sourceUrl: '开源平台地址',
      sourceUrlHint: '可以是拖入也可以从硬盘选择，也可以GitHub，gitee这种开源平台的skill的所在地址',
      importAction: '导入',
      importing: '导入中…',
      sourceRequired: '请先选择文件或填写地址',
      sourceUnsupported: '请选择 .md 文件',
      sourceRead: '已读取 {name}',
      sourceUrlPending: '导入时会读取该地址',
      sourceSession: '会话',
      tagsHintSession: '保存后，这些标签会归到「会话」主标签下',
      subTagsUser: '用户子标签',
      subTagsSession: '会话子标签',
      allSubTags: '全部',
      externalTag: '其他途径来源',
      tooLong: '这个文件太长，无法在面板内编辑',
      notReady: '当前工作区会话尚未就绪',
      notOpen: '当前工作区会话尚未打开',
      hostMissing: '当前配置没有 /skill-hub 命令',
    };

    const en = {
      button: 'Skills',
      buttonTitle: 'BetterSkillManager: configure skills for workspace sessions',
      title: 'BetterSkillManager',
      tabSession: 'Workspace sessions',
      tabUser: 'User-level',
      search: 'Search skills',
      tags: 'Filter by tag',
      clearFilters: 'Clear filters',
      loading: 'Loading…',
      empty: 'No skills available',
      emptyUser: 'No user-level skills yet',
      filterEmpty: 'No matching skills',
      error: 'Failed to load',
      retry: 'Retry',
      refresh: 'Refresh',
      close: 'Close',
      use: 'Use',
      view: 'View',
      edit: 'Edit',
      delete: 'Delete',
      save: 'Save',
      saving: 'Saving…',
      cancel: 'Cancel',
      confirmDelete: 'Delete this skill?',
      confirmDeleteHint: 'This cannot be undone.',
      saved: 'Saved',
      imported: 'Imported',
      deleted: 'Deleted',
      savedRefreshFailed: 'Saved, but the catalog refresh failed. Use Refresh.',
      savedNotSynced: 'The file was written, but the catalog has not updated yet. Use Refresh.',
      loadFailed: 'Could not read the skill file',
      retryLoad: 'Reload',
      multipleSkills: 'That folder contains multiple skills; drop one skill folder.',
      insertFailed: 'The composer cannot be edited right now',
      hostUnavailable: 'The host command is unavailable',
      name: 'Name',
      content: 'File content',
      nameHint: 'Lowercase letters, digits, and hyphens',
      nameRequired: 'The name must be lowercase kebab-case',
      editTitle: 'Edit skill',
      sectionName: 'Name',
      sectionTags: 'Tags',
      sectionScope: 'Scope',
      sectionContent: 'File content',
      scopeSession: 'Workspace sessions',
      scopeSessionHint: 'Sessions in the current workspace only',
      scopeUser: 'User-level',
      scopeUserHint: 'Available in every session',
      scopeUnavailable: 'This workspace has no working directory; only the user level is available',
      scopeMoveHint: 'Saving moves the file',
      nameChangedHint: 'Renaming also updates name in the frontmatter',
      noTags: 'No tags yet',
      addTag: 'Add',
      addTagHint: 'Type a tag and press Enter',
      removeTag: 'Remove tag',
      suggestedTags: 'Common tags',
      tagHint: 'Tags are written to the SKILL.md frontmatter',
      sourceProject: 'Project',
      sourceUser: 'User',
      sourceBundled: 'Built-in',
      sourceOther: 'Other',
      userOnly: 'User only',
      count: '{n} skills',
      readOnlyHint: 'The complete file, including YAML frontmatter. Saving syncs the name and tags modules above.',
      addSkill: 'Add',
      back: 'Back',
      importTitle: 'Add a skill',
      importSource: 'Skill file',
      dropTitle: 'Drop a SKILL.md or a skill folder',
      chooseFile: 'Choose from disk',
      sourceUrl: 'Open-source URL',
      sourceUrlHint:
        'Drop a file, choose one from disk, or paste the address of a skill on GitHub, Gitee, or another open-source platform',
      importAction: 'Import',
      importing: 'Importing…',
      sourceRequired: 'Choose a file or paste an address first',
      sourceUnsupported: 'Choose a .md file',
      sourceRead: 'Loaded {name}',
      sourceUrlPending: 'This address is read on import',
      sourceSession: 'Session',
      tagsHintSession: 'After saving, these tags sit under the Session main tag',
      subTagsUser: 'User sub-tags',
      subTagsSession: 'Session sub-tags',
      allSubTags: 'All',
      externalTag: 'Other source',
      tooLong: 'This file is too long to edit in the panel',
      notReady: 'The workspace session is not ready yet',
      notOpen: 'The workspace session is not open yet',
      hostMissing: 'This profile has no /skill-hub command',
    };

    const CSS = `
.sh-trigger{display:inline-flex;align-items:center;gap:5px;height:28px;min-width:0;padding:0 8px;border:0;border-radius:var(--dsw-radius-sm,6px);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;font-weight:500;line-height:20px;cursor:pointer}
.sh-trigger:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2)}
.sh-trigger:focus-visible{outline:none;box-shadow:0 0 0 2px var(--dsw-alias-brand-primary)}
.sh-trigger:disabled{color:var(--dsw-alias-label-caption);cursor:default}
.sh-trigger svg{width:14px;height:14px;flex:none}
.sh-triggerLabel{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sh-layer{position:fixed;inset:0;z-index:1000}
.sh-panel{position:fixed;display:flex;flex-direction:column;overflow:hidden;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-overlay);border:.5px solid var(--dsw-alias-border-l1);border-radius:12px;box-shadow:0 12px 32px rgba(0,0,0,.18);font-size:13px;line-height:20px;transition:height .22s ease}
.sh-head{display:flex;align-items:center;gap:6px;padding:10px 10px 8px 14px;border-bottom:.5px solid var(--dsw-alias-border-l1);flex:none}
.sh-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;font-weight:600;line-height:22px}
.sh-iconBtn{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;flex:none;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer}
.sh-iconBtn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.sh-iconBtn:focus-visible{outline:none;box-shadow:0 0 0 2px var(--dsw-alias-brand-primary)}
.sh-iconBtn:disabled{color:var(--dsw-alias-label-caption);cursor:default}
.sh-iconBtn svg{width:15px;height:15px}
.sh-addBtn{display:inline-flex;align-items:center;gap:4px;height:26px;padding:0 9px;flex:none;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;font-weight:500;cursor:pointer}
.sh-addBtn:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.sh-addBtn:focus-visible{outline:none;box-shadow:0 0 0 2px var(--dsw-alias-brand-primary)}
.sh-addBtn svg{width:12px;height:12px}
.sh-tabs{display:flex;align-items:center;gap:8px;padding:8px 12px 0;flex:none}
.sh-segment{position:relative;display:inline-flex;align-items:stretch;width:min(236px,100%);box-sizing:border-box;padding:3px;border-radius:9px;background:rgba(127,127,127,.08);background:color-mix(in srgb,var(--dsw-alias-label-primary) 6%,transparent);flex:none}
.sh-segmentGlider{position:absolute;top:3px;bottom:3px;left:3px;width:calc(50% - 3px);border-radius:7px;background:rgba(255,255,255,.55);border:1px solid rgba(255,255,255,.68);-webkit-backdrop-filter:blur(16px) saturate(1.6);backdrop-filter:blur(16px) saturate(1.6);box-shadow:0 2px 8px rgba(0,0,0,.10),inset 0 1px 0 rgba(255,255,255,.8);transition:transform .22s cubic-bezier(.22,.8,.28,1);pointer-events:none}
body[data-ds-dark-theme] .sh-segmentGlider{background:rgba(255,255,255,.14);border-color:rgba(255,255,255,.22);box-shadow:0 2px 8px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.18)}
.sh-segmentGlider[data-index="1"]{transform:translateX(100%)}
.sh-tab{position:relative;z-index:1;flex:1 1 0;min-width:0;height:28px;padding:0 6px;border:0;border-radius:7px;background:transparent;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:12px;font-weight:500;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:color .16s ease}
.sh-tab:hover{color:var(--dsw-alias-label-secondary)}
.sh-tab[data-active="true"]{color:var(--dsw-alias-label-primary);font-weight:600}
.sh-tab:focus-visible{outline:none;box-shadow:0 0 0 2px var(--dsw-alias-brand-primary)}
.sh-tabSpacer{flex:1}
.sh-search{display:flex;align-items:center;gap:6px;margin:8px 12px 6px;padding:0 8px;height:30px;flex:none;border:.5px solid var(--dsw-alias-border-l2);border-radius:8px;color:var(--dsw-alias-label-caption)}
.sh-search:focus-within{border-color:var(--dsw-alias-brand-primary)}
.sh-search input{flex:1;min-width:0;height:100%;border:0;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;outline:none}
.sh-search input::placeholder{color:var(--dsw-alias-label-caption)}
.sh-search svg{width:14px;height:14px;flex:none}
.sh-tagbar{display:flex;align-items:center;gap:6px;padding:0 12px 8px;flex:none;overflow-x:auto;scrollbar-width:none}
.sh-tagbar::-webkit-scrollbar{display:none}
.sh-chip{flex:none;height:24px;padding:0 9px;border:1px solid var(--dsw-alias-border-l2);border-radius:999px;background:transparent;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:11px;line-height:22px;cursor:pointer;transition:background-color .15s ease,border-color .15s ease,color .15s ease}
.sh-chip:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2)}
.sh-chip[data-active="true"]{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-2)}
.sh-chipClear{color:var(--dsw-alias-state-error-primary)}
.sh-subtagbar{display:flex;align-items:center;gap:6px;padding:0 12px 8px;flex:none;overflow-x:auto;scrollbar-width:none;animation:shFadeIn .15s ease}
.sh-subtagbar::-webkit-scrollbar{display:none}
.sh-subtagLabel{flex:none;font-size:10px;line-height:15px;color:var(--dsw-alias-label-caption);margin-right:-2px}
.sh-body{flex:1;min-height:0;overflow-y:auto;padding:0 12px 10px}
.sh-fade{animation:shFadeIn .18s ease}
@keyframes shFadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
.sh-row{position:relative;display:flex;align-items:flex-start;gap:4px;box-sizing:border-box;border:1px solid transparent;border-radius:12px;padding:3px;margin-bottom:6px;transition:transform .16s ease,border-color .16s ease,background-color .16s ease,box-shadow .16s ease}
.sh-row:hover{transform:scale(1.05);z-index:1;border-color:var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);box-shadow:0 4px 14px rgba(0,0,0,.07)}
.sh-rowMain{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px;border:0;background:transparent;color:inherit;text-align:left;padding:6px 8px;border-radius:8px;cursor:pointer;font:inherit}
.sh-rowMain:focus-visible{outline:none;box-shadow:inset 0 0 0 2px var(--dsw-alias-brand-primary)}
.sh-rowTitle{display:flex;align-items:center;gap:6px;min-width:0}
.sh-name{font-weight:500;color:var(--dsw-alias-label-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sh-badge{flex:none;font-size:10px;line-height:16px;padding:0 5px;border-radius:4px;color:var(--dsw-alias-label-tertiary);background:var(--dsw-alias-bg-overlay);border:.5px solid var(--dsw-alias-border-l2)}
.sh-badge[data-tone="warn"]{color:var(--dsw-alias-state-warn-primary)}
.sh-desc{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:17px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word}
.sh-rowTags{display:flex;flex-wrap:wrap;gap:4px;margin-top:3px}
.sh-rowTag{font-size:10px;line-height:15px;padding:0 5px;border-radius:4px;color:var(--dsw-alias-label-tertiary);background:var(--dsw-alias-bg-layer-2)}
.sh-rowActions{display:flex;align-items:center;gap:2px;padding-top:4px;flex:none}
.sh-smallBtn{height:24px;padding:0 7px;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:11px;cursor:pointer;white-space:nowrap}
.sh-smallBtn:hover:not(:disabled){background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary)}
.sh-smallBtn[data-danger="true"]:hover{color:var(--dsw-alias-state-error-primary)}
.sh-empty{padding:28px 16px;text-align:center;color:var(--dsw-alias-label-tertiary);font-size:12px}
.sh-emptyAction{margin-top:10px}
.sh-status{padding:6px 14px 10px;flex:none;min-height:22px;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary);border-top:.5px solid var(--dsw-alias-border-l1)}
.sh-status[data-error="true"]{color:var(--dsw-alias-state-error-primary)}
.sh-confirm{display:flex;align-items:center;gap:8px;padding:8px 14px;flex:none;border-top:.5px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2)}
.sh-confirmText{flex:1;min-width:0;font-size:12px;line-height:17px;color:var(--dsw-alias-label-secondary)}
.sh-confirmHint{color:var(--dsw-alias-label-caption)}
.sh-confirmActions{display:flex;gap:2px;flex:none}
.sh-editor{display:flex;flex-direction:column;flex:1;min-height:0}
.sh-editorScroll{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:10px;padding:10px 12px}
.sh-editorTitle{font-size:12px;font-weight:600;line-height:18px;color:var(--dsw-alias-label-secondary)}
.sh-section{display:flex;flex-direction:column;gap:6px;padding:10px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px}
.sh-sectionTitle{font-size:11px;font-weight:600;line-height:16px;color:var(--dsw-alias-label-secondary)}
.sh-field{display:flex;flex-direction:column;gap:3px}
.sh-fieldLabel{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary)}
.sh-input,.sh-textarea{width:100%;box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l2);border-radius:7px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;padding:6px 8px;outline:none}
.sh-input:focus,.sh-textarea:focus{border-color:var(--dsw-alias-brand-primary)}
.sh-textarea{resize:vertical;min-height:64px;line-height:19px}
.sh-textarea[data-code="true"]{min-height:200px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;line-height:18px;white-space:pre;overflow:auto}
.sh-hint{font-size:11px;line-height:16px;color:var(--dsw-alias-label-caption)}
.sh-editorError{padding:6px 8px;border-radius:6px;font-size:11px;line-height:16px;color:var(--dsw-alias-state-error-primary);background:var(--dsw-alias-bg-layer-2)}
.sh-editorFooter{flex:none;display:flex;justify-content:flex-end;gap:8px;padding:8px 12px;border-top:.5px solid var(--dsw-alias-border-l1)}
.sh-tagEditor{display:flex;flex-wrap:wrap;gap:6px;min-height:22px;align-items:center}
.sh-tagPill{display:inline-flex;align-items:center;gap:4px;height:22px;padding:0 6px 0 8px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-size:11px}
.sh-tagRemove{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border:0;border-radius:50%;background:transparent;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1;cursor:pointer}
.sh-tagRemove:hover{color:var(--dsw-alias-state-error-primary);background:var(--dsw-alias-bg-overlay)}
.sh-tagAdd{display:flex;align-items:center;gap:6px}
.sh-tagInput{flex:1;min-width:0}
.sh-tagSuggest{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.sh-scope{display:flex;gap:8px}
.sh-scopeOption{flex:1;display:flex;flex-direction:column;gap:2px;padding:8px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:transparent;color:var(--dsw-alias-label-tertiary);text-align:left;font:inherit;cursor:pointer;transition:background-color .15s ease,border-color .15s ease,color .15s ease}
.sh-scopeOption:hover:not(:disabled){color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2)}
.sh-scopeOption[data-active="true"]{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.sh-scopeOption:disabled{opacity:.5;cursor:default}
.sh-scopeTitle{font-size:12px;font-weight:500}
.sh-scopeHint{font-size:10px;line-height:14px;color:var(--dsw-alias-label-caption)}
.sh-dropzone{display:flex;flex-direction:column;align-items:center;gap:6px;padding:18px 12px;border:1px dashed var(--dsw-alias-border-l2);border-radius:10px;text-align:center;color:var(--dsw-alias-label-tertiary);cursor:pointer;transition:border-color .15s ease,background-color .15s ease}
.sh-dropzone:hover{border-color:var(--dsw-alias-brand-primary)}
.sh-dropzone[data-over="true"]{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-2)}
.sh-dropzone:focus-visible{outline:none;box-shadow:0 0 0 2px var(--dsw-alias-brand-primary)}
.sh-dropzoneTitle{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}
.sh-dropzoneHint{font-size:11px;line-height:16px;color:var(--dsw-alias-label-caption)}
.sh-sourceRow{display:flex;align-items:center;gap:6px}
.sh-sourceRow .sh-input{flex:1;min-width:0}
.sh-sourceLabel{font-size:11px;line-height:16px;color:var(--dsw-alias-state-success-primary);word-break:break-all}
.sh-preview{max-height:120px;overflow:auto;white-space:pre-wrap;word-break:break-word;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;line-height:16px;padding:8px;border-radius:8px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-tertiary)}
.sh-primaryBtn,.sh-ghostBtn{height:28px;padding:0 12px;border-radius:6px;font:inherit;font-size:12px;font-weight:500;cursor:pointer}
.sh-primaryBtn{border:.5px solid var(--dsw-alias-label-primary);background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-base)}
.sh-primaryBtn:disabled{opacity:.45;cursor:default}
.sh-primaryBtn:focus-visible,.sh-ghostBtn:focus-visible{outline:none;box-shadow:0 0 0 2px var(--dsw-alias-brand-primary)}
.sh-ghostBtn{border:.5px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-secondary)}
.sh-ghostBtn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2)}
@media (max-width:520px){.sh-triggerLabel{display:none}}
@media (prefers-reduced-motion:reduce){.sh-panel,.sh-row,.sh-chip,.sh-tab,.sh-fade,.sh-subtagbar{animation:none;transition:none}.sh-segmentGlider{transition:none}.sh-row:hover{transform:none}}
`;

    function Svg(props) {
      return h(
        'svg',
        {
          viewBox: '0 0 16 16',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.4,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          ...props,
        },
        props.children,
      );
    }

    function SkillIcon(props) {
      return h(
        Svg,
        props,
        h('path', { d: 'M3 3.5A1.5 1.5 0 0 1 4.5 2H12v10.5H5a2 2 0 0 0-2 2V3.5Z' }),
        h('path', { d: 'M5 12.5h7V14H5a1.5 1.5 0 0 1 0-3' }),
        h('path', { d: 'M6.2 5.2h3.6M6.2 7.4h2.4' }),
      );
    }

    function SearchIcon(props) {
      return h(Svg, props, h('circle', { cx: 7, cy: 7, r: 4.2 }), h('path', { d: 'm10.2 10.2 3 3' }));
    }

    function CloseIcon(props) {
      return h(Svg, props, h('path', { d: 'M4 4l8 8M12 4l-8 8' }));
    }

    function RefreshIcon(props) {
      return h(
        Svg,
        props,
        h('path', { d: 'M13 8a5 5 0 1 1-1.5-3.5' }),
        h('path', { d: 'M13 2.5V5h-2.5' }),
      );
    }

    function PlusIcon(props) {
      return h(Svg, props, h('path', { d: 'M8 3v10M3 8h10' }));
    }

    function BackIcon(props) {
      return h(Svg, props, h('path', { d: 'M13 8H4M8 3 3 8l5 5' }));
    }

    /** Whether a path uses a Windows drive or UNC prefix. */
    function isAbsolutePath(value) {
      return value.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(value) || value.startsWith('\\\\');
    }

    function encodeSegment(segment) {
      return encodeURIComponent(segment).replace(/%3A/gi, ':');
    }

    /** Build the session-scoped file address the right Sidebar opens. */
    function fileAddressFor(sessionId, cwd, value) {
      const normalized = String(value).replace(/\\/g, '/');
      let pathPart = normalized;
      if (isAbsolutePath(normalized)) {
        const root = String(cwd || '')
          .replace(/\\/g, '/')
          .replace(/\/+$/, '');
        if (root.length > 0 && normalized === root) pathPart = '';
        else if (root.length > 0 && normalized.startsWith(root + '/')) pathPart = normalized.slice(root.length + 1);
      }
      const encoded = pathPart.split('/').map(encodeSegment).join('/');
      return `${FILE_ADDRESS_PREFIX}session/${encodeSegment(sessionId)}/${encoded}`;
    }

    /** Classify a skill by the instruction file it came from. */
    function classify(skill, cwd, roots) {
      const value = typeof skill.path === 'string' ? skill.path.replace(/\\/g, '/') : '';
      // Pathless skills are provided by the composition/runtime, not by a
      // user or project file, so they belong with the built-in group.
      if (value.length === 0) return 'bundled';
      if (value.includes('/node_modules/')) return 'bundled';

      const under = (root) => {
        const base = String(root || '')
          .replace(/\\/g, '/')
          .replace(/\/+$/, '');
        return base.length > 0 && (value === base || value.startsWith(`${base}/`));
      };
      const projectRoots = Array.isArray(roots?.project) ? roots.project : [];
      const userRoots = Array.isArray(roots?.user) ? roots.user : [];
      if (userRoots.some(under)) return 'user';
      if (projectRoots.some(under)) return 'project';
      if (projectRoots.length > 0 || userRoots.length > 0) {
        // Explicit roots are authoritative: a path outside them is not a
        // user/workspace skill (for example a custom provider or a plugin).
        return 'bundled';
      }

      // Fallback until the host roots are available.
      const root = String(cwd || '')
        .replace(/\\/g, '/')
        .replace(/\/+$/, '');
      if (root.length > 0 && (value === root || value.startsWith(root + '/'))) return 'project';
      for (const marker of ['/.dsh/skills/', '/.agents/skills/']) {
        const index = value.indexOf(marker);
        if (index <= 0) continue;
        const projectRoot = value.slice(0, index);
        if (root === projectRoot || root.startsWith(projectRoot + '/')) return 'project';
      }
      return 'user';
    }

    function filterSkills(items, query) {
      const needle = String(query || '').trim().toLowerCase();
      if (needle.length === 0) return items;
      return items.filter((skill) =>
        `${skill.name} ${skill.description || ''} ${skill.whenToUse || ''} ${(skill.tags || []).join(' ')}`
          .toLowerCase()
          .includes(needle),
      );
    }

    function messageOf(error) {
      if (error && typeof error === 'object' && typeof error.code === 'string') {
        return `${error.code}: ${error.message || ''}`.trim();
      }
      if (error instanceof Error) return error.message;
      return String(error);
    }

    /** Normalize one user tag. */
    function normalizeTag(value) {
      const tag = String(value ?? '')
        .trim()
        .replace(/^#+/u, '')
        .replace(/^['"]|['"]$/gu, '')
        .trim();
      if (tag.length === 0 || tag.length > MAX_TAG_LENGTH || RESERVED_TAGS.has(tag)) return undefined;
      return tag;
    }

    function normalizeTagList(values) {
      const list = [];
      for (const value of Array.isArray(values) ? values : []) {
        const tag = normalizeTag(value);
        if (tag !== undefined && !list.includes(tag)) list.push(tag);
        if (list.length >= MAX_TAGS) break;
      }
      return list;
    }

    function sameTags(left, right) {
      const a = Array.isArray(left) ? left : [];
      const b = Array.isArray(right) ? right : [];
      return a.length === b.length && a.every((tag) => b.includes(tag));
    }

    /** Bracket depth outside quotes; used to collect a multi-line flow value. */
    function flowDepth(text) {
      let depth = 0;
      let quote = null;
      for (let index = 0; index < text.length; index += 1) {
        const character = text[index];
        if (quote !== null) {
          if (character === '\\' && quote === '"') index += 1;
          else if (character === quote) quote = null;
          continue;
        }
        if (character === '"' || character === "'") {
          quote = character;
          continue;
        }
        if (character === '#' && (index === 0 || /\s/u.test(text[index - 1]))) break;
        if (character === '[' || character === '{') depth += 1;
        else if (character === ']' || character === '}') depth -= 1;
      }
      return depth;
    }

    /** Split a flow sequence on commas outside quotes. */
    function splitFlowList(text) {
      const parts = [];
      let buffer = '';
      let quote = null;
      for (let index = 0; index < text.length; index += 1) {
        const character = text[index];
        if (quote !== null) {
          buffer += character;
          if (character === '\\' && quote === '"') {
            buffer += text[index + 1] ?? '';
            index += 1;
          } else if (character === quote) {
            quote = null;
          }
          continue;
        }
        if (character === '"' || character === "'") {
          quote = character;
          buffer += character;
          continue;
        }
        if (character === '#' && (index === 0 || /\s/u.test(text[index - 1]))) break;
        if (character === ',') {
          parts.push(buffer);
          buffer = '';
          continue;
        }
        buffer += character;
      }
      if (buffer.trim().length > 0) parts.push(buffer);
      return parts;
    }

    /** Read the `tags` field from a SKILL.md frontmatter block. */
    function parseTags(content) {
      const lines = String(content ?? '').split(/\r?\n/u);
      if (lines[0]?.trim() !== '---') return [];
      let end = -1;
      for (let index = 1; index < lines.length; index += 1) {
        if (lines[index].trim() === '---') {
          end = index;
          break;
        }
      }
      if (end < 0) return [];
      for (let index = 1; index < end; index += 1) {
        const match = /^tags\s*:\s*(.*)$/u.exec(lines[index]);
        if (match === null) continue;
        let value = match[1].trim();
        if (value.startsWith('[')) {
          // A flow sequence may span several lines.
          let cursor = index;
          while (flowDepth(value) > 0 && cursor + 1 < end) {
            cursor += 1;
            value += ` ${lines[cursor].trim()}`;
          }
          try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) return normalizeTagList(parsed);
          } catch {
            /* fall through to comma splitting */
          }
          const inner = value.replace(/^\[/u, '').replace(/\]\s*$/u, '');
          return normalizeTagList(splitFlowList(inner));
        }
        if (value.length > 0) return normalizeTagList(value.split(','));
        const list = [];
        for (let cursor = index + 1; cursor < end; cursor += 1) {
          const item = /^\s*-\s+(.*)$/u.exec(lines[cursor]);
          if (item === null) break;
          list.push(item[1]);
        }
        return normalizeTagList(list);
      }
      return [];
    }

    /** Parse the JSON text a successful host command returns. */
    function parseResult(execution) {
      const text = execution !== null && typeof execution === 'object' && execution.result ? execution.result.text : undefined;
      if (typeof text !== 'string' || text.length === 0) return {};
      try {
        return JSON.parse(text);
      } catch {
        return {};
      }
    }

    /** The same FNV-1a identity the host uses over raw file bytes. */
    function contentHashBytes(data) {
      let hash = 2166136261;
      for (const byte of data) {
        hash ^= byte;
        hash = Math.imul(hash, 16777619);
      }
      return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
    }

    function contentHash(value) {
      return contentHashBytes(new TextEncoder().encode(String(value ?? '')));
    }

    async function mapLimit(items, limit, worker) {
      const results = new Array(items.length);
      let cursor = 0;
      const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
        for (;;) {
          const index = cursor;
          cursor += 1;
          if (index >= items.length) return;
          results[index] = await worker(items[index]);
        }
      });
      await Promise.all(runners);
      return results;
    }

    /** Read one simple frontmatter scalar (name/description). */
    function frontmatterValue(content, field) {
      const lines = String(content ?? '').split(/\r?\n/u);
      if (lines[0]?.trim() !== '---') return undefined;
      let end = -1;
      for (let index = 1; index < lines.length; index += 1) {
        if (lines[index].trim() === '---') {
          end = index;
          break;
        }
      }
      if (end < 0) return undefined;
      const pattern = new RegExp(`^${field}\\s*:\\s*(.*)$`, 'u');
      for (let index = 1; index < end; index += 1) {
        const match = pattern.exec(lines[index]);
        if (match === null) continue;
        const raw = match[1].trim();
        if (raw.length === 0) return undefined;
        if (raw.startsWith('"')) {
          try {
            return String(JSON.parse(raw));
          } catch {
            return raw.replace(/^"|"$/gu, '');
          }
        }
        if (raw.startsWith("'")) return raw.replace(/^'|'$/gu, '');
        return raw;
      }
      return undefined;
    }

    /** Turn an arbitrary label into a kebab-case skill name. */
    function sanitizeSkillName(value) {
      const name = String(value ?? '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/gu, '-')
        .replace(/^-+|-+$/gu, '');
      if (name.length === 0) return '';
      return name.slice(0, 80);
    }

    /** Read every file of a dropped entry with its path relative to the drop. */
    async function entryFiles(entry, prefix = '') {
      if (entry === null || typeof entry !== 'object') return [];
      if (entry.isFile === true) {
        const file = await new Promise((resolve, reject) => entry.file(resolve, reject));
        return [{ file, path: `${prefix}${file.name}`, fromDirectory: prefix.length > 0 }];
      }
      if (entry.isDirectory === true) {
        const reader = entry.createReader();
        const collected = [];
        // readEntries returns batches (at most 100 on Chromium), so drain it.
        for (;;) {
          const batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
          if (batch.length === 0) break;
          for (const item of batch) {
            collected.push(...(await entryFiles(item, `${prefix}${entry.name}/`)));
          }
        }
        return collected;
      }
      return [];
    }

    const inject = [
      'slots',
      'sessions',
      'locale',
      'remote',
      'remote.commands',
      'remote.skills',
      'remote.workspaceFiles',
      'sidebarRight',
    ];

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'skill-hub: dictionaries');
      ctx.effect(() => {
        const style = document.createElement('style');
        style.dataset.plugin = PLUGIN_ID;
        style.textContent = CSS;
        document.head.appendChild(style);
        return () => style.remove();
      }, 'skill-hub: styles');

      const sessions = ctx.sessions;
      const skillsRemote = ctx.remote.skills;
      const filesRemote = ctx.remote.workspaceFiles;
      const sidebar = ctx.sidebarRight;

      async function fetchSkills(sessionId, signal) {
        if (sessions.binding(sessionId) === undefined) throw new Error('notReady');
        return sessions.using(
          sessionId,
          { source: 'skillHub', ...(signal === undefined ? {} : { signal }) },
          async (reference) => {
            if (signal !== undefined && signal.aborted) throw new Error('aborted');
            const state = reference.binding.session.getSnapshot();
            if (state.openState !== 'open') throw state.openError ?? new Error('notOpen');
            const result = await skillsRemote.list({ sessionId }, signal);
            if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
            return result.value.skills;
          },
        );
      }

      /** First frontmatter page only — enough for tags, cheaper than a full read. */
      async function readSkillHead(sessionId, filePath, signal) {
        const result = await filesRemote.read(sessionId, filePath, { offset: 1, limit: 200 }, signal);
        if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
        return result.value.text;
      }

      async function readSkillText(sessionId, filePath) {
        let offset = 1;
        let out = '';
        for (let page = 0; page < 20; page += 1) {
          const result = await filesRemote.read(sessionId, filePath, { offset, limit: 5000 });
          if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
          const value = result.value;
          if (value.text.length > 0) out += (out.length > 0 ? '\n' : '') + value.text;
          if (value.eof) return out;
          offset = value.offset + value.lines;
        }
        throw new Error('tooLong');
      }

      /**
       * Read the exact bytes so the base hash matches the Host's hash even when
       * the line-paged reader drops CRLF or the final newline. Falls back to the
       * line reader on Hosts that do not expose `readBytes`.
       */
      async function readSkillFile(sessionId, filePath, signal) {
        if (typeof filesRemote.readBytes === 'function') {
          const result = await filesRemote.readBytes(sessionId, filePath, {}, signal);
          if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
          const value = result.value;
          const data = value.data instanceof Uint8Array ? value.data : new Uint8Array(value.data ?? []);
          return {
            text: new TextDecoder('utf-8').decode(data),
            hash: contentHashBytes(data),
          };
        }
        const text = await readSkillText(sessionId, filePath);
        return { text, hash: contentHash(text) };
      }

      async function runCommand(sessionId, payload) {
        const result = await ctx.remote.commands.execute(sessionId, `/skill-hub ${JSON.stringify(payload)}`, []);
        if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
        const execution = result.value;
        if (execution === undefined) throw new Error('hostMissing');
        const outcome = execution !== null && typeof execution === 'object' ? execution.result : undefined;
        if (outcome !== undefined && outcome.kind === 'error') throw new Error(outcome.text);
        return execution;
      }

      async function fetchSkillMeta(sessionId, items, cwd, roots, signal) {
        const editable = items.filter((item) => {
          if (typeof item.path !== 'string' || item.path.length === 0) return false;
          const scope = classify(item, cwd, roots);
          return scope === 'user' || scope === 'project';
        });
        const entries = await mapLimit(editable, 6, async (item) => {
          try {
            const head = await readSkillHead(sessionId, item.path, signal);
            return [
              item.name,
              {
                tags: parseTags(head),
                managed: frontmatterValue(head, 'managed-by') === 'skill-hub',
              },
            ];
          } catch {
            // An unreadable file has unknown provenance, not "external".
            return [item.name, { tags: [], managed: undefined }];
          }
        });
        const tags = {};
        const managed = {};
        for (const [name, meta] of entries) {
          if (meta.tags.length > 0) tags[name] = meta.tags;
          if (meta.managed !== undefined) managed[name] = meta.managed;
        }
        return { tags, managed };
      }

      async function refreshAfter(sessionId, predicate, cwd, roots) {
        let list = await fetchSkills(sessionId);
        if (!predicate(list)) {
          for (let attempt = 0; attempt < 9; attempt += 1) {
            await new Promise((resolve) => setTimeout(resolve, 350));
            list = await fetchSkills(sessionId);
            if (predicate(list)) break;
          }
        }
        const meta = await fetchSkillMeta(sessionId, list, cwd, roots);
        return { list, tags: meta.tags, managed: meta.managed, synced: predicate(list) };
      }

      function SkillHub(props) {
        const { sessionId, inputActions, t } = props;
        const cwd = ctx.sessions.list.getSnapshot().byId?.[sessionId]?.cwd;

        const tr = useCallback(
          (key, params) => {
            if (typeof t === 'function') {
              const value = t(key, params);
              if (typeof value === 'string') return value;
            }
            return key;
          },
          [t],
        );

        const localizeError = useCallback(
          (message) => {
            if (message === 'notReady' || message === 'notOpen' || message === 'tooLong' || message === 'hostMissing') {
              return tr(message);
            }
            return message;
          },
          [tr],
        );

        const [open, setOpen] = useState(false);
        const [tab, setTab] = useState('session');
        const [query, setQuery] = useState('');
        const [catalog, setCatalog] = useState(null);
        const [tagMap, setTagMap] = useState({});
        const [originMap, setOriginMap] = useState({});
        const [roots, setRoots] = useState({ user: [], project: [] });
        const [activeCategory, setActiveCategory] = useState(null);
        const [activeSubTag, setActiveSubTag] = useState(null);
        const [loading, setLoading] = useState(false);
        const [error, setError] = useState(null);
        const [notice, setNotice] = useState(null);
        const [refreshTick, setRefreshTick] = useState(0);
        const [editor, setEditor] = useState(null);
        const [editorTagInput, setEditorTagInput] = useState('');
        const [confirmDelete, setConfirmDelete] = useState(null);
        const [anchor, setAnchor] = useState(null);

        const buttonRef = useRef(null);
        const searchRef = useRef(null);
        const fileInputRef = useRef(null);
        const panelRef = useRef(null);
        const dropApiRef = useRef({});
        const alive = useRef(true);
        const rootsCache = useRef({ key: null, value: null });
        const editorRef = useRef(null);
        editorRef.current = editor;
        const activeDraftRef = useRef(null);
        const sessionRef = useRef(sessionId);
        sessionRef.current = sessionId;

        useEffect(() => {
          alive.current = true;
          return () => {
            alive.current = false;
          };
        }, []);

        const resolveRoots = useCallback(async () => {
          const key = `${sessionId}::${cwd ?? ''}`;
          const cached = rootsCache.current;
          if (cached.key === key && cached.value !== null) return cached.value;
          try {
            const result = parseResult(await runCommand(sessionId, { op: 'roots' }));
            const value = {
              user: Array.isArray(result.user) ? result.user : [],
              project: Array.isArray(result.project) ? result.project : [],
            };
            rootsCache.current = { key, value };
            return value;
          } catch {
            return { user: [], project: [] };
          }
        }, [sessionId, cwd]);

        const close = useCallback(() => {
          if (editorRef.current !== null && editorRef.current.busy === true) return;
          activeDraftRef.current = null;
          setOpen(false);
          setEditor(null);
          setEditorTagInput('');
          setConfirmDelete(null);
          window.setTimeout(() => buttonRef.current?.focus?.(), 0);
        }, []);

        const backToList = useCallback(() => {
          if (editorRef.current !== null && editorRef.current.busy === true) return;
          activeDraftRef.current = null;
          setEditor(null);
          setEditorTagInput('');
          setConfirmDelete(null);
          window.setTimeout(() => searchRef.current?.focus?.(), 0);
        }, []);

        // Measure the trigger before opening so the first frame is already at
        // the final position; the fallback centred style is never painted.
        const measureAnchor = useCallback(() => {
          const element = buttonRef.current;
          if (element === null) return null;
          const rect = element.getBoundingClientRect();
          const width = Math.min(460, window.innerWidth - 16);
          const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
          const bottom = Math.max(8, window.innerHeight - rect.top + 8);
          const height = Math.max(120, Math.min(520, window.innerHeight - bottom - 12));
          return { left, bottom, width, height };
        }, []);

        // Reset transient panel state when the slot is reused for another Session.
        useEffect(() => {
          setEditor(null);
          setEditorTagInput('');
          setConfirmDelete(null);
          setNotice(null);
          setQuery('');
          setCatalog(null);
          setTagMap({});
          setOriginMap({});
          setRoots({ user: [], project: [] });
          rootsCache.current = { key: null, value: null };
          activeDraftRef.current = null;
          setActiveCategory(null);
          setActiveSubTag(null);
          setError(null);
        }, [sessionId]);

        // Load the catalog and the editable skills' tags.
        useEffect(() => {
          if (!open) return undefined;
          const controller = new AbortController();
          let current = true;
          setLoading(true);
          setError(null);
          (async () => {
            const resolvedRoots = await resolveRoots();
            if (!current || controller.signal.aborted) return;
            const list = await fetchSkills(sessionId, controller.signal);
            if (!current || controller.signal.aborted) return;
            // Resolve tags before publishing the list so rows do not reflow
            // after the panel has already appeared.
            const meta = await fetchSkillMeta(sessionId, list, cwd, resolvedRoots, controller.signal);
            if (!current || controller.signal.aborted) return;
            setRoots(resolvedRoots);
            setCatalog(list);
            setTagMap(meta.tags);
            setOriginMap(meta.managed);
            setLoading(false);
          })().catch((failure) => {
            if (!current || controller.signal.aborted) return;
            setCatalog(null);
            setError(localizeError(messageOf(failure)));
            setLoading(false);
          });
          return () => {
            current = false;
            controller.abort();
          };
        }, [open, sessionId, refreshTick, cwd, resolveRoots]);

        // Anchor the popover to the trigger and keep it in the viewport.
        useEffect(() => {
          if (!open) return undefined;
          const update = () => {
            const next = measureAnchor();
            if (next === null) return;
            setAnchor((current) =>
              current !== null &&
              current.left === next.left &&
              current.bottom === next.bottom &&
              current.width === next.width &&
              current.height === next.height
                ? current
                : next,
            );
          };
          update();
          window.addEventListener('resize', update);
          window.addEventListener('scroll', update, true);
          return () => {
            window.removeEventListener('resize', update);
            window.removeEventListener('scroll', update, true);
          };
        }, [open, measureAnchor]);

        // Escape leaves the editor/confirmation first, then the panel.
        useEffect(() => {
          if (!open) return undefined;
          const onKeyDown = (event) => {
            if (event.key !== 'Escape' || event.defaultPrevented) return;
            const target = event.target;
            const inSearch = target instanceof Element && target.closest('.sh-search') !== null;
            // Let the search input clear its own text first.
            if (inSearch && query.length > 0) return;
            event.preventDefault();
            event.stopPropagation();
            if (editor !== null) {
              if (editor.busy === true) return;
              backToList();
              setConfirmDelete(null);
              return;
            }
            if (confirmDelete !== null) {
              setConfirmDelete(null);
              return;
            }
            close();
          };
          document.addEventListener('keydown', onKeyDown, true);
          return () => document.removeEventListener('keydown', onKeyDown, true);
        }, [open, close, backToList, editor, confirmDelete, query]);

        // Move focus into the panel after it opens.
        useEffect(() => {
          if (!open) return undefined;
          const timer = setTimeout(() => {
            if (searchRef.current !== null && typeof searchRef.current.focus === 'function') searchRef.current.focus();
          }, 40);
          return () => clearTimeout(timer);
        }, [open]);

        // Retire a transient status line.
        useEffect(() => {
          if (notice === null) return undefined;
          const timer = setTimeout(() => setNotice(null), 3200);
          return () => clearTimeout(timer);
        }, [notice]);

        // The attachment view installs document-level (bubble) file-drop
        // listeners. While the importer is open, capture drags over this panel
        // first so the composer never claims them.
        useEffect(() => {
          if (editor === null || editor.mode !== 'import') return undefined;
          const panel = panelRef.current;
          if (panel === null) return undefined;
          const hasFiles = (event) => {
            const transfer = event.dataTransfer;
            if (transfer === null) return false;
            try {
              return Array.from(transfer.types).includes('Files');
            } catch {
              return false;
            }
          };
          const inDropzone = (event) =>
            event.target instanceof Element && event.target.closest('[data-skill-hub-dropzone]') !== null;
          const stop = (event) => {
            event.preventDefault();
            event.stopPropagation();
          };
          const clearComposerDrag = () => {
            try {
              window.dispatchEvent(new Event('dragend'));
            } catch {
              /* ignore */
            }
          };
          const onDragEnter = (event) => {
            if (!hasFiles(event)) return;
            stop(event);
            clearComposerDrag();
          };
          const onDragOver = (event) => {
            if (!hasFiles(event)) return;
            stop(event);
            const over = inDropzone(event);
            if (event.dataTransfer !== null) event.dataTransfer.dropEffect = over ? 'copy' : 'none';
            dropApiRef.current.setDragOver?.(over);
          };
          const onDragLeave = (event) => {
            if (!hasFiles(event)) return;
            event.stopPropagation();
            const next = event.relatedTarget;
            if (!(next instanceof Node) || !panel.contains(next)) dropApiRef.current.setDragOver?.(false);
          };
          const onDrop = (event) => {
            if (!hasFiles(event)) return;
            stop(event);
            dropApiRef.current.setDragOver?.(false);
            if (inDropzone(event)) dropApiRef.current.onDrop?.(event);
            clearComposerDrag();
          };
          panel.addEventListener('dragenter', onDragEnter, true);
          panel.addEventListener('dragover', onDragOver, true);
          panel.addEventListener('dragleave', onDragLeave, true);
          panel.addEventListener('drop', onDrop, true);
          return () => {
            panel.removeEventListener('dragenter', onDragEnter, true);
            panel.removeEventListener('dragover', onDragOver, true);
            panel.removeEventListener('dragleave', onDragLeave, true);
            panel.removeEventListener('drop', onDrop, true);
          };
        }, [editor === null ? null : editor.mode]);

        const scoped = useMemo(
          () =>
            (catalog ?? []).map((skill) => {
              const scope = classify(skill, cwd, roots);
              const fileTags = Array.isArray(tagMap[skill.name]) ? tagMap[skill.name] : [];
              const editable = scope === 'user' || scope === 'project';
              const external = editable && originMap[skill.name] === false;
              return {
                ...skill,
                scope,
                tags: external ? [...fileTags, tr('externalTag')] : fileTags,
              };
            }),
          [catalog, cwd, roots, tagMap, originMap, tr],
        );

        const allCustomTags = useMemo(() => {
          const counts = new Map();
          for (const list of Object.values(tagMap)) {
            if (!Array.isArray(list)) continue;
            for (const tag of list) counts.set(tag, (counts.get(tag) ?? 0) + 1);
          }
          return [...counts.entries()]
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
            .map(([tag]) => tag);
        }, [tagMap]);

        const subTagGroups = useMemo(() => {
          const user = new Map();
          const session = new Map();
          for (const skill of scoped) {
            const category = skill.scope === 'project' ? 'session' : skill.scope;
            if (category !== 'user' && category !== 'session') continue;
            const target = category === 'user' ? user : session;
            for (const tag of skill.tags) target.set(tag, (target.get(tag) ?? 0) + 1);
          }
          const list = (map) =>
            [...map.entries()]
              .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
              .map(([tag]) => tag);
          return { user: list(user), session: list(session) };
        }, [scoped]);

        const mainChips = useMemo(
          () => [
            { key: 'bundled', label: tr('sourceBundled') },
            { key: 'user', label: tr('sourceUser') },
            { key: 'session', label: tr('sourceSession') },
          ],
          [tr],
        );

        const activeSubTags = useMemo(() => {
          if (activeCategory === 'user') return subTagGroups.user;
          if (activeCategory === 'session') return subTagGroups.session;
          return [];
        }, [activeCategory, subTagGroups]);

        // Drop a sub-tag filter that no longer exists.
        useEffect(() => {
          if (activeSubTag !== null && !activeSubTags.includes(activeSubTag)) setActiveSubTag(null);
        }, [activeSubTag, activeSubTags]);

        const tabList = useMemo(
          () => scoped.filter((skill) => (tab === 'user' ? skill.scope === 'user' : true)),
          [scoped, tab],
        );
        const tagged = useMemo(() => {
          if (activeCategory === null) return tabList;
          const categoryList = tabList.filter(
            (skill) => (skill.scope === 'project' ? 'session' : skill.scope) === activeCategory,
          );
          if (activeSubTag === null) return categoryList;
          return categoryList.filter((skill) => skill.tags.includes(activeSubTag));
        }, [tabList, activeCategory, activeSubTag]);
        const visible = useMemo(() => filterSkills(tagged, query), [tagged, query]);

        const editorSuggestions = useMemo(() => {
          if (editor === null) return [];
          return allCustomTags.filter((tag) => !editor.tags.includes(tag)).slice(0, 12);
        }, [allCustomTags, editor]);

        const openPanel = () => {
          const next = measureAnchor();
          if (next !== null) setAnchor(next);
          setNotice(null);
          setError(null);
          // Avoid a first-frame flash of the empty state before the load effect runs.
          setLoading(true);
          setOpen(true);
        };

        const chooseCategory = (category) => {
          if (activeCategory === category) {
            if (activeSubTag !== null) setActiveSubTag(null);
            else setActiveCategory(null);
          } else {
            setActiveCategory(category);
            setActiveSubTag(null);
          }
        };

        const chooseSubTag = (tag) => {
          setActiveSubTag((current) => (current === tag ? null : tag));
        };

        const clearFilters = () => {
          setActiveCategory(null);
          setActiveSubTag(null);
        };

        const useSkill = (skill) => {
          if (!inputActions) {
            setNotice({ kind: 'error', text: tr('insertFailed') });
            return;
          }
          try {
            const span =
              typeof inputActions.captureInsertion === 'function' ? inputActions.captureInsertion() : undefined;
            if (span === undefined || span === null) {
              setNotice({ kind: 'error', text: tr('insertFailed') });
              return;
            }
            if (typeof inputActions.insertText === 'function') inputActions.insertText(`/${skill.name} `, span);
            close();
          } catch (failure) {
            setNotice({ kind: 'error', text: messageOf(failure) });
          }
        };

        const preview = (skill) => {
          if (typeof skill.path !== 'string' || skill.path.length === 0) return;
          try {
            sidebar.openResource(fileAddressFor(sessionId, cwd, skill.path));
          } catch (failure) {
            setNotice({ kind: 'error', text: messageOf(failure) });
          }
        };

        const startEdit = async (skill) => {
          if (typeof skill.path !== 'string' || skill.path.length === 0) return;
          setConfirmDelete(null);
          setEditorTagInput('');
          const id = ++draftSeq;
          const editSession = sessionId;
          activeDraftRef.current = id;
          setEditor({
            id,
            mode: 'edit',
            path: skill.path,
            originalName: skill.name,
            name: skill.name,
            content: '',
            tags: [],
            baseTags: [],
            scope: skill.scope === 'project' ? 'session' : 'user',
            scopeTouched: false,
            loading: true,
            loadError: null,
            tagsTouched: false,
            baseHash: '',
            busy: false,
            error: null,
          });
          try {
            const file = await readSkillFile(sessionId, skill.path);
            if (!alive.current || sessionRef.current !== editSession) return;
            setEditor((current) =>
              current !== null && current.id === id
                ? {
                    ...current,
                    content: file.text,
                    tags: parseTags(file.text),
                    baseTags: parseTags(file.text),
                    baseHash: file.hash,
                    loading: false,
                    loadError: null,
                  }
                : current,
            );
          } catch (failure) {
            if (!alive.current || sessionRef.current !== editSession) return;
            setEditor((current) =>
              current !== null && current.id === id
                ? { ...current, loading: false, loadError: localizeError(messageOf(failure)) }
                : current,
            );
          }
        };

        const reloadEditor = async () => {
          const draft = editorRef.current;
          if (draft === null || draft.mode !== 'edit') return;
          const id = draft.id;
          const editSession = sessionId;
          setEditor((current) =>
            current !== null && current.id === id ? { ...current, loading: true, loadError: null } : current,
          );
          try {
            const file = await readSkillFile(sessionId, draft.path);
            if (!alive.current || sessionRef.current !== editSession) return;
            setEditor((current) =>
              current !== null && current.id === id
                ? {
                    ...current,
                    content: file.text,
                    tags: parseTags(file.text),
                    baseTags: parseTags(file.text),
                    baseHash: file.hash,
                    loading: false,
                    loadError: null,
                  }
                : current,
            );
          } catch (failure) {
            if (!alive.current || sessionRef.current !== editSession) return;
            setEditor((current) =>
              current !== null && current.id === id
                ? { ...current, loading: false, loadError: localizeError(messageOf(failure)) }
                : current,
            );
          }
        };

        const updateEditor = (key, value) => {
          setEditor((current) => (current === null ? current : { ...current, [key]: value }));
        };

        const chooseScope = (scope) => {
          setEditor((current) => (current === null ? current : { ...current, scope, scopeTouched: true }));
        };

        const addTagValue = (raw) => {
          const tag = normalizeTag(raw);
          if (tag === undefined) return;
          setEditor((current) => {
            if (current === null) return current;
            if (current.tags.includes(tag) || current.tags.length >= MAX_TAGS) return current;
            return { ...current, tags: [...current.tags, tag], tagsTouched: true };
          });
          setEditorTagInput('');
        };

        const removeTag = (tag) => {
          setEditor((current) =>
            current === null
              ? current
              : { ...current, tags: current.tags.filter((item) => item !== tag), tagsTouched: true },
          );
        };

        const startImport = () => {
          setConfirmDelete(null);
          setEditorTagInput('');
          const id = ++draftSeq;
          activeDraftRef.current = id;
          setEditor({
            id,
            mode: 'import',
            name: '',
            tags: [],
            tagsTouched: false,
            scope: 'user',
            scopeTouched: true,
            content: '',
            sourceLabel: '',
            sourceUrl: '',
            dragOver: false,
            busy: false,
            error: null,
          });
        };

        const applySourceText = (text, label) => {
          const derivedName = frontmatterValue(text, 'name') ?? String(label ?? '').replace(/\.md$/iu, '');
          const sourceTags = parseTags(text);
          setEditor((current) => {
            if (current === null || current.mode !== 'import') return current;
            const name = current.name.trim().length > 0 ? current.name : sanitizeSkillName(derivedName);
            return {
              ...current,
              content: text,
              sourceLabel: label,
              sourceUrl: '',
              dragOver: false,
              error: null,
              name,
              tags: current.tagsTouched ? current.tags : sourceTags,
            };
          });
        };

        const acceptFiles = async (entries) => {
          const list = Array.isArray(entries) ? entries : [];
          const skillCandidates = list.filter((entry) => /^skill\.md$/iu.test(entry.file.name));
          const inDirectory = list.some((entry) => entry.fromDirectory === true);
          let chosen;
          if (inDirectory) {
            if (skillCandidates.length === 0) {
              setEditor((current) =>
                current !== null && current.mode === 'import'
                  ? { ...current, error: tr('sourceUnsupported'), dragOver: false }
                  : current,
              );
              return;
            }
            const sorted = [...skillCandidates].sort(
              (left, right) => left.path.split('/').length - right.path.split('/').length,
            );
            const depth = sorted[0].path.split('/').length;
            if (sorted.filter((entry) => entry.path.split('/').length === depth).length > 1) {
              setEditor((current) =>
                current !== null && current.mode === 'import'
                  ? { ...current, error: tr('multipleSkills'), dragOver: false }
                  : current,
              );
              return;
            }
            chosen = sorted[0];
          } else {
            const markdown = list.filter((entry) => /\.md$/iu.test(entry.file.name));
            if (markdown.length === 0) {
              setEditor((current) =>
                current !== null && current.mode === 'import'
                  ? { ...current, error: tr('sourceUnsupported'), dragOver: false }
                  : current,
              );
              return;
            }
            const skillFile = markdown.find((entry) => /^skill\.md$/iu.test(entry.file.name));
            if (skillFile === undefined && markdown.length > 1) {
              setEditor((current) =>
                current !== null && current.mode === 'import'
                  ? { ...current, error: tr('multipleSkills'), dragOver: false }
                  : current,
              );
              return;
            }
            chosen = skillFile ?? markdown[0];
          }
          try {
            const text = await chosen.file.text();
            if (!alive.current) return;
            applySourceText(text, chosen.path || chosen.file.name);
          } catch (failure) {
            if (!alive.current) return;
            setEditor((current) =>
              current !== null && current.mode === 'import'
                ? { ...current, error: messageOf(failure), dragOver: false }
                : current,
            );
          }
        };

        const handleFileInput = async (event) => {
          const files = event.target.files ? [...event.target.files] : [];
          event.target.value = '';
          await acceptFiles(files.map((file) => ({ file, path: file.name, fromDirectory: false })));
        };

        const pickFile = () => {
          if (fileInputRef.current !== null) fileInputRef.current.click();
        };

        const handleDragOver = (event) => {
          event.preventDefault();
          event.stopPropagation();
          setEditor((current) =>
            current !== null && current.mode === 'import' && current.dragOver === false
              ? { ...current, dragOver: true }
              : current,
          );
        };

        const handleDragLeave = (event) => {
          event.preventDefault();
          event.stopPropagation();
          setEditor((current) =>
            current !== null && current.mode === 'import' ? { ...current, dragOver: false } : current,
          );
        };

        const handleDrop = async (event) => {
          event.preventDefault();
          event.stopPropagation();
          setEditor((current) =>
            current !== null && current.mode === 'import' ? { ...current, dragOver: false } : current,
          );
          const transfer = event.dataTransfer;
          const files = [];
          const items = transfer?.items;
          if (items && items.length > 0 && typeof items[0]?.webkitGetAsEntry === 'function') {
            const entries = [];
            for (const item of items) {
              const entry = item.webkitGetAsEntry?.();
              if (entry) entries.push(entry);
            }
            if (entries.length > 0) {
              try {
                const nested = await Promise.all(entries.map((entry) => entryFiles(entry)));
                files.push(...nested.flat());
              } catch {
                /* fall back to plain files */
              }
            }
          }
          if (files.length === 0 && transfer?.files) {
            files.push(...[...transfer.files].map((file) => ({ file, path: file.name, fromDirectory: false })));
          }
          await acceptFiles(files);
        };

        const updateSourceUrl = (value) => {
          setEditor((current) => {
            if (current === null || current.mode !== 'import') return current;
            const next = {
              ...current,
              sourceUrl: value,
              content: '',
              sourceLabel: '',
              ...(current.tagsTouched ? {} : { tags: [] }),
            };
            if (current.name.trim().length === 0) {
              const segment = value.split(/[?#]/u)[0].split('/').filter(Boolean).pop() ?? '';
              const derived = sanitizeSkillName(segment.replace(/\.md$/iu, ''));
              if (derived.length > 0) next.name = derived;
            }
            return next;
          });
        };

        dropApiRef.current = {
          setDragOver: (over) =>
            setEditor((current) =>
              current !== null && current.mode === 'import' && current.dragOver !== over
                ? { ...current, dragOver: over }
                : current,
            ),
          onDrop: handleDrop,
        };

        const saveEditor = async () => {
          const draft = editor;
          if (draft === null || draft.busy || draft.loading || draft.loadError != null) return;
          const name = draft.name.trim();
          if (!NAME_PATTERN.test(name)) {
            setEditor({ ...draft, error: tr('nameRequired') });
            return;
          }
          if (
            draft.mode === 'import' &&
            draft.content.trim().length === 0 &&
            draft.sourceUrl.trim().length === 0
          ) {
            setEditor({ ...draft, error: tr('sourceRequired') });
            return;
          }
          const draftId = draft.id;
          const saveSession = sessionId;
          setEditor({ ...draft, busy: true, error: null });
          let result;
          try {
            if (draft.mode === 'import') {
              const payload = { op: 'import', name, scope: draft.scope };
              if (draft.tagsTouched) payload.tags = draft.tags;
              if (draft.content.trim().length > 0) payload.content = draft.content;
              else payload.sourceUrl = draft.sourceUrl.trim();
              result = parseResult(await runCommand(sessionId, payload));
            } else {
              const payload = { op: 'save', path: draft.path, name, content: draft.content, tags: draft.tags };
              payload.nameChanged = name !== draft.originalName;
              payload.tagsChanged = !sameTags(draft.tags, draft.baseTags ?? []);
              if (draft.scopeTouched) payload.scope = draft.scope;
              if (typeof draft.baseHash === 'string' && draft.baseHash.length > 0) payload.baseHash = draft.baseHash;
              result = parseResult(await runCommand(sessionId, payload));
            }
          } catch (failure) {
            if (!alive.current || sessionRef.current !== saveSession) return;
            setEditor((current) =>
              current !== null && current.id === draftId
                ? { ...current, busy: false, error: localizeError(messageOf(failure)) }
                : current,
            );
            return;
          }
          if (!alive.current || sessionRef.current !== saveSession) return;
          const savedName = typeof result.name === 'string' && result.name.length > 0 ? result.name : name;
          const oldName = draft.mode === 'edit' ? draft.originalName : undefined;
          const wantScope = draft.scope;
          const rootsNow = await resolveRoots();
          if (!alive.current || sessionRef.current !== saveSession) return;
          if (activeDraftRef.current === draftId) {
            activeDraftRef.current = null;
            setEditor(null);
            setTab(wantScope === 'user' ? 'user' : 'session');
            setNotice({ kind: 'ok', text: tr(draft.mode === 'import' ? 'imported' : 'saved') });
          }
          try {
            const scopeOk = (items) => {
              if (draft.mode === 'edit' && draft.scopeTouched === false) return true;
              const entry = items.find((item) => item.name === savedName);
              if (entry === undefined) return false;
              const scope = classify(entry, cwd, rootsNow);
              return wantScope === 'session' ? scope === 'project' : scope === 'user';
            };
            const { list, tags: nextTags, managed, synced } = await refreshAfter(
              sessionId,
              (items) =>
                items.some((item) => item.name === savedName) &&
                (oldName === undefined || oldName === savedName || !items.some((item) => item.name === oldName)) &&
                scopeOk(items),
              cwd,
              rootsNow,
            );
            if (!alive.current || sessionRef.current !== saveSession) return;
            setCatalog(list);
            setTagMap(nextTags);
            setOriginMap(managed);
            if (!synced) setNotice({ kind: 'error', text: tr('savedNotSynced') });
          } catch (failure) {
            if (!alive.current || sessionRef.current !== saveSession) return;
            setNotice({ kind: 'error', text: tr('savedRefreshFailed') });
          }
        };

        const removeSkill = async (skill) => {
          setConfirmDelete(null);
          if (typeof skill.path !== 'string' || skill.path.length === 0) return;
          const deleteSession = sessionId;
          try {
            await runCommand(sessionId, { op: 'delete', path: skill.path, name: skill.name });
          } catch (failure) {
            if (!alive.current || sessionRef.current !== deleteSession) return;
            setNotice({ kind: 'error', text: localizeError(messageOf(failure)) });
            return;
          }
          if (!alive.current || sessionRef.current !== deleteSession) return;
          setNotice({ kind: 'ok', text: tr('deleted') });
          try {
            const rootsNow = await resolveRoots();
            const { list, tags: nextTags, managed, synced } = await refreshAfter(
              sessionId,
              (items) => !items.some((item) => item.name === skill.name),
              cwd,
              rootsNow,
            );
            if (!alive.current || sessionRef.current !== deleteSession) return;
            setCatalog(list);
            setTagMap(nextTags);
            setOriginMap(managed);
            if (!synced) setNotice({ kind: 'error', text: tr('savedNotSynced') });
          } catch (failure) {
            if (!alive.current || sessionRef.current !== deleteSession) return;
            setNotice({ kind: 'error', text: tr('savedRefreshFailed') });
          }
        };

        const renderRow = (skill) => {
          const editable = skill.scope === 'user' || skill.scope === 'project';
          const sourceKey =
            skill.scope === 'project'
              ? 'sourceSession'
              : `source${skill.scope[0].toUpperCase()}${skill.scope.slice(1)}`;
          return h(
            'div',
            { className: 'sh-row', key: `${skill.name}::${skill.path || ''}` },
            h(
              'button',
              {
                type: 'button',
                className: 'sh-rowMain',
                title: tr('use'),
                onClick: () => useSkill(skill),
              },
              h(
                'div',
                { className: 'sh-rowTitle' },
                h('span', { className: 'sh-name' }, `/${skill.name}`),
                h('span', { className: 'sh-badge', 'data-tone': skill.scope }, tr(sourceKey)),
                skill.modelInvocable === false
                  ? h('span', { className: 'sh-badge', 'data-tone': 'warn' }, tr('userOnly'))
                  : null,
              ),
              h('div', { className: 'sh-desc' }, skill.whenToUse || skill.description || ''),
              skill.tags.length > 0
                ? h(
                    'div',
                    { className: 'sh-rowTags' },
                    skill.tags.slice(0, 3).map((tag) => h('span', { className: 'sh-rowTag', key: tag }, `#${tag}`)),
                    skill.tags.length > 3
                      ? h('span', { className: 'sh-rowTag' }, `+${skill.tags.length - 3}`)
                      : null,
                  )
                : null,
            ),
            h(
              'div',
              { className: 'sh-rowActions' },
              typeof skill.path === 'string' && skill.path.length > 0
                ? h('button', { type: 'button', className: 'sh-smallBtn', onClick: () => preview(skill) }, tr('view'))
                : null,
              editable
                ? h('button', { type: 'button', className: 'sh-smallBtn', onClick: () => startEdit(skill) }, tr('edit'))
                : null,
              editable
                ? h(
                    'button',
                    {
                      type: 'button',
                      className: 'sh-smallBtn',
                      'data-danger': 'true',
                      onClick: () => setConfirmDelete(skill),
                    },
                    tr('delete'),
                  )
                : null,
            ),
          );
        };

        const section = (title, ...children) =>
          h('section', { className: 'sh-section' }, h('div', { className: 'sh-sectionTitle' }, title), ...children);

        const renderTagSection = (draft) =>
          section(
            tr('sectionTags'),
            h(
              'div',
              { className: 'sh-tagEditor' },
              draft.tags.length === 0
                ? h('span', { className: 'sh-hint' }, tr('noTags'))
                : draft.tags.map((tag) =>
                    h(
                      'span',
                      { className: 'sh-tagPill', key: tag },
                      `#${tag}`,
                      h(
                        'button',
                        {
                          type: 'button',
                          className: 'sh-tagRemove',
                          'aria-label': tr('removeTag'),
                          onClick: () => removeTag(tag),
                        },
                        '×',
                      ),
                    ),
                  ),
            ),
            h(
              'div',
              { className: 'sh-tagAdd' },
              h('input', {
                className: 'sh-input sh-tagInput',
                type: 'text',
                value: editorTagInput,
                placeholder: tr('addTagHint'),
                onChange: (event) => setEditorTagInput(event.target.value),
                onKeyDown: (event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addTagValue(editorTagInput);
                  }
                },
              }),
              h('button', { type: 'button', className: 'sh-smallBtn', onClick: () => addTagValue(editorTagInput) }, tr('addTag')),
            ),
            editorSuggestions.length > 0
              ? h(
                  'div',
                  { className: 'sh-tagSuggest' },
                  h('span', { className: 'sh-hint' }, tr('suggestedTags')),
                  editorSuggestions.map((tag) =>
                    h('button', { type: 'button', className: 'sh-chip', key: tag, onClick: () => addTagValue(tag) }, `#${tag}`),
                  ),
                )
              : null,
            h('div', { className: 'sh-hint' }, draft.scope === 'session' ? tr('tagsHintSession') : tr('tagHint')),
          );

        const renderScopeSection = (draft) =>
          section(
            tr('sectionScope'),
            h(
              'div',
              { className: 'sh-scope' },
              h(
                'button',
                {
                  type: 'button',
                  className: 'sh-scopeOption',
                  'data-active': draft.scope === 'session' ? 'true' : undefined,
                  disabled: roots.project.length === 0,
                  onClick: () => chooseScope('session'),
                },
                h('span', { className: 'sh-scopeTitle' }, tr('scopeSession')),
                h('span', { className: 'sh-scopeHint' }, tr('scopeSessionHint')),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'sh-scopeOption',
                  'data-active': draft.scope === 'user' ? 'true' : undefined,
                  onClick: () => chooseScope('user'),
                },
                h('span', { className: 'sh-scopeTitle' }, tr('scopeUser')),
                h('span', { className: 'sh-scopeHint' }, tr('scopeUserHint')),
              ),
            ),
            h('div', { className: 'sh-hint' }, roots.project.length === 0 ? tr('scopeUnavailable') : tr('scopeMoveHint')),
          );

        const renderImporter = () => {
          const draft = editor;
          if (draft === null || draft.mode !== 'import') return null;
          const hasContent = typeof draft.content === 'string' && draft.content.trim().length > 0;
          const hasUrl = typeof draft.sourceUrl === 'string' && draft.sourceUrl.trim().length > 0;
          const preview = hasContent ? draft.content.slice(0, 4000) : '';
          return h(
            'div',
            { className: 'sh-editor sh-fade', key: 'editor' },
            h(
              'div',
              { className: 'sh-editorScroll' },
              h('div', { className: 'sh-editorTitle' }, tr('importTitle')),
              section(
                tr('sectionName'),
                h('input', {
                  className: 'sh-input',
                  type: 'text',
                  value: draft.name,
                  placeholder: tr('nameHint'),
                  spellCheck: false,
                  onChange: (event) => updateEditor('name', event.target.value),
                }),
              ),
              renderTagSection(draft),
              renderScopeSection(draft),
              section(
                tr('importSource'),
                h(
                  'div',
                  {
                    className: 'sh-dropzone',
                    'data-skill-hub-dropzone': 'true',
                    role: 'button',
                    tabIndex: 0,
                    'data-over': draft.dragOver ? 'true' : undefined,
                    onClick: pickFile,
                    onKeyDown: (event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        pickFile();
                      }
                    },
                    onDragOver: handleDragOver,
                    onDragLeave: handleDragLeave,
                    onDrop: handleDrop,
                  },
                  h('div', { className: 'sh-dropzoneTitle' }, tr('dropTitle')),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'sh-smallBtn',
                      onClick: (event) => {
                        event.stopPropagation();
                        pickFile();
                      },
                    },
                    tr('chooseFile'),
                  ),
                ),
                h(
                  'div',
                  { className: 'sh-sourceRow' },
                  h('input', {
                    className: 'sh-input',
                    type: 'text',
                    value: draft.sourceUrl,
                    placeholder: 'https://github.com/owner/repo/tree/main/skills/demo',
                    onChange: (event) => updateSourceUrl(event.target.value),
                  }),
                ),
                h('div', { className: 'sh-hint' }, tr('sourceUrlHint')),
                draft.sourceLabel
                  ? h('div', { className: 'sh-sourceLabel' }, tr('sourceRead', { name: draft.sourceLabel }))
                  : null,
                preview
                  ? h('pre', { className: 'sh-preview' }, `${preview}${draft.content.length > 4000 ? '\n…' : ''}`)
                  : hasUrl
                    ? h('div', { className: 'sh-hint' }, tr('sourceUrlPending'))
                    : null,
              ),
              draft.error !== null
                ? h('div', { className: 'sh-editorError', role: 'alert' }, draft.error)
                : null,
            ),
            h(
              'div',
              { className: 'sh-editorFooter' },
              h('button', { type: 'button', className: 'sh-ghostBtn', onClick: backToList, disabled: draft.busy }, tr('cancel')),
              h(
                'button',
                {
                  type: 'button',
                  className: 'sh-primaryBtn',
                  onClick: saveEditor,
                  disabled: draft.busy || (!hasContent && !hasUrl),
                },
                draft.busy ? tr('importing') : tr('importAction'),
              ),
            ),
            h('input', {
              ref: fileInputRef,
              type: 'file',
              accept: '.md,text/markdown',
              hidden: true,
              onChange: handleFileInput,
            }),
          );
        };

        const renderEditor = () => {
          if (editor === null) return null;
          if (editor.mode === 'import') return renderImporter();
          if (editor.loading) {
            return h('div', { className: 'sh-editor' }, h('div', { className: 'sh-empty' }, tr('loading')));
          }
          if (editor.loadError != null) {
            return h(
              'div',
              { className: 'sh-editor sh-fade' },
              h(
                'div',
                { className: 'sh-editorScroll' },
                h('div', { className: 'sh-editorTitle' }, tr('editTitle')),
                h('div', { className: 'sh-editorError', role: 'alert' }, editor.loadError),
                h('div', { className: 'sh-hint' }, tr('loadFailed')),
              ),
              h(
                'div',
                { className: 'sh-editorFooter' },
                h('button', { type: 'button', className: 'sh-ghostBtn', onClick: backToList }, tr('cancel')),
                h('button', { type: 'button', className: 'sh-primaryBtn', onClick: reloadEditor }, tr('retryLoad')),
              ),
            );
          }
          const contentSection = section(
            tr('sectionContent'),
            h('textarea', {
              className: 'sh-textarea',
              'data-code': 'true',
              value: editor.content,
              spellCheck: false,
              onChange: (event) => updateEditor('content', event.target.value),
            }),
            h('div', { className: 'sh-hint' }, tr('readOnlyHint')),
          );

          return h(
            'div',
            { className: 'sh-editor sh-fade', key: 'editor' },
            h(
              'div',
              { className: 'sh-editorScroll' },
              h('div', { className: 'sh-editorTitle' }, tr('editTitle')),
              section(
                tr('sectionName'),
                h('input', {
                  className: 'sh-input',
                  type: 'text',
                  value: editor.name,
                  placeholder: tr('nameHint'),
                  spellCheck: false,
                  onChange: (event) => updateEditor('name', event.target.value),
                }),
                h('div', { className: 'sh-hint' }, tr('nameChangedHint')),
              ),
              renderTagSection(editor),
              renderScopeSection(editor),
              contentSection,
              editor.error !== null
                ? h('div', { className: 'sh-editorError', role: 'alert' }, editor.error)
                : null,
            ),
            h(
              'div',
              { className: 'sh-editorFooter' },
              h('button', { type: 'button', className: 'sh-ghostBtn', onClick: backToList, disabled: editor.busy }, tr('cancel')),
              h('button', { type: 'button', className: 'sh-primaryBtn', onClick: saveEditor, disabled: editor.busy || editor.loading || editor.loadError != null }, editor.busy ? tr('saving') : tr('save')),
            ),
          );
        };

        const tagbar =
          editor === null
            ? h(
                React.Fragment,
                null,
                h(
                  'div',
                  { className: 'sh-tagbar', role: 'group', 'aria-label': tr('tags') },
                  mainChips.map((chip) =>
                    h(
                      'button',
                      {
                        type: 'button',
                        key: chip.key,
                        className: 'sh-chip',
                        'data-active': activeCategory === chip.key ? 'true' : undefined,
                        'aria-pressed': activeCategory === chip.key,
                        onClick: () => chooseCategory(chip.key),
                      },
                      chip.label,
                    ),
                  ),
                  activeCategory !== null
                    ? h(
                        'button',
                        { type: 'button', className: 'sh-chip sh-chipClear', onClick: clearFilters },
                        tr('clearFilters'),
                      )
                    : null,
                ),
                activeCategory !== null && activeSubTags.length > 0
                  ? h(
                      'div',
                      { className: 'sh-subtagbar' },
                      h(
                        'span',
                        { className: 'sh-subtagLabel' },
                        tr(activeCategory === 'user' ? 'subTagsUser' : 'subTagsSession'),
                      ),
                      h(
                        'button',
                        {
                          type: 'button',
                          className: 'sh-chip',
                          'data-active': activeSubTag === null ? 'true' : undefined,
                          'aria-pressed': activeSubTag === null,
                          onClick: () => setActiveSubTag(null),
                        },
                        tr('allSubTags'),
                      ),
                      activeSubTags.map((tag) =>
                        h(
                          'button',
                          {
                            type: 'button',
                            key: tag,
                            className: 'sh-chip',
                            'data-active': activeSubTag === tag ? 'true' : undefined,
                            'aria-pressed': activeSubTag === tag,
                            onClick: () => chooseSubTag(tag),
                          },
                          `#${tag}`,
                        ),
                      ),
                    )
                  : null,
              )
            : null;

        const noticeText =
          notice !== null
            ? notice.text
            : catalog !== null && editor === null
              ? tr('count', { n: scoped.length })
              : '';

        const panel = h(
          'div',
          {
            className: 'sh-layer',
            onMouseDown: (event) => {
              if (event.target === event.currentTarget) close();
            },
          },
          h(
            'div',
            {
              className: 'sh-panel',
              ref: panelRef,
              role: 'dialog',
              'aria-modal': 'false',
              'aria-label': tr('title'),
              style:
                anchor === null
                  ? {
                      left: '50%',
                      bottom: '18%',
                      transform: 'translateX(-50%)',
                      width: 'min(460px, calc(100vw - 16px))',
                      height: 'min(520px, 70vh)',
                    }
                  : {
                      left: `${anchor.left}px`,
                      bottom: `${anchor.bottom}px`,
                      width: `${anchor.width}px`,
                      height: `${anchor.height}px`,
                    },
            },
            h(
              'div',
              { className: 'sh-head' },
              h('div', { className: 'sh-title' }, tr('title')),
              editor === null
                ? h(
                    'button',
                    { type: 'button', className: 'sh-addBtn', title: tr('importTitle'), onClick: startImport },
                    h(PlusIcon),
                    tr('addSkill'),
                  )
                : h(
                    'button',
                    { type: 'button', className: 'sh-addBtn', title: tr('back'), onClick: backToList },
                    h(BackIcon),
                    tr('back'),
                  ),
              editor === null
                ? h(
                    'button',
                    {
                      type: 'button',
                      className: 'sh-iconBtn',
                      title: tr('refresh'),
                      'aria-label': tr('refresh'),
                      onClick: () => setRefreshTick((value) => value + 1),
                      disabled: loading,
                    },
                    h(RefreshIcon),
                  )
                : null,
              h(
                'button',
                { type: 'button', className: 'sh-iconBtn', title: tr('close'), 'aria-label': tr('close'), onClick: close, disabled: editor !== null && editor.busy === true },
                h(CloseIcon),
              ),
            ),
            editor === null
              ? h(
                  'div',
                  { className: 'sh-tabs' },
                  h(
                    'div',
                    { className: 'sh-segment', role: 'tablist', 'aria-label': tr('title') },
                    h('span', {
                      className: 'sh-segmentGlider',
                      'data-index': tab === 'user' ? '1' : '0',
                      'aria-hidden': true,
                    }),
                    h(
                      'button',
                      {
                        type: 'button',
                        role: 'tab',
                        className: 'sh-tab',
                        'data-active': tab === 'session' ? 'true' : undefined,
                        'aria-selected': tab === 'session',
                        onClick: () => {
                          setTab('session');
                          clearFilters();
                        },
                      },
                      tr('tabSession'),
                    ),
                    h(
                      'button',
                      {
                        type: 'button',
                        role: 'tab',
                        className: 'sh-tab',
                        'data-active': tab === 'user' ? 'true' : undefined,
                        'aria-selected': tab === 'user',
                        onClick: () => {
                          setTab('user');
                          clearFilters();
                        },
                      },
                      tr('tabUser'),
                    ),
                  ),
                )
              : null,
            editor === null
              ? h(
                  'div',
                  { className: 'sh-search' },
                  h(SearchIcon),
                  h('input', {
                    ref: searchRef,
                    type: 'text',
                    value: query,
                    placeholder: tr('search'),
                    'aria-label': tr('search'),
                    onKeyDown: (event) => {
                      if (event.key === 'Escape') {
                        event.preventDefault();
                        if (query.length > 0) setQuery('');
                        else close();
                      }
                    },
                    onChange: (event) => setQuery(event.target.value),
                  }),
                )
              : null,
            tagbar,
            editor !== null
              ? renderEditor()
              : h(
                  'div',
                  { className: 'sh-body sh-fade', key: `tab-${tab}` },
                  loading && catalog === null
                    ? h('div', { className: 'sh-empty' }, tr('loading'))
                    : error !== null
                      ? h(
                          'div',
                          { className: 'sh-empty' },
                          h('div', null, `${tr('error')}: ${error}`),
                          h(
                            'div',
                            { className: 'sh-emptyAction' },
                            h(
                              'button',
                              {
                                type: 'button',
                                className: 'sh-smallBtn',
                                onClick: () => setRefreshTick((value) => value + 1),
                              },
                              tr('retry'),
                            ),
                          ),
                        )
                      : visible.length === 0
                        ? h(
                            'div',
                            { className: 'sh-empty' },
                            h('div', null, activeCategory !== null ? tr('filterEmpty') : tab === 'user' ? tr('emptyUser') : tr('empty')),
                            activeCategory !== null
                              ? h(
                                  'div',
                                  { className: 'sh-emptyAction' },
                                  h(
                                    'button',
                                    { type: 'button', className: 'sh-smallBtn', onClick: clearFilters },
                                    tr('clearFilters'),
                                  ),
                                )
                              : null,
                          )
                        : visible.map(renderRow),
                ),
            confirmDelete !== null && editor === null
              ? h(
                  'div',
                  { className: 'sh-confirm' },
                  h(
                    'div',
                    { className: 'sh-confirmText' },
                    tr('confirmDelete'),
                    ' ',
                    h('span', { className: 'sh-confirmHint' }, tr('confirmDeleteHint')),
                  ),
                  h(
                    'div',
                    { className: 'sh-confirmActions' },
                    h('button', { type: 'button', className: 'sh-smallBtn', onClick: () => setConfirmDelete(null) }, tr('cancel')),
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'sh-smallBtn',
                        'data-danger': 'true',
                        onClick: () => removeSkill(confirmDelete),
                      },
                      tr('delete'),
                    ),
                  ),
                )
              : null,
            h(
              'div',
              { className: 'sh-status', 'data-error': notice !== null && notice.kind === 'error' ? 'true' : undefined, role: 'status' },
              noticeText,
            ),
          ),
        );

        return h(
          React.Fragment,
          null,
          h(
            'button',
            {
              ref: buttonRef,
              type: 'button',
              className: 'sh-trigger',
              title: tr('buttonTitle'),
              'aria-haspopup': 'dialog',
              'aria-expanded': open,
              onClick: openPanel,
            },
            h(SkillIcon),
            h('span', { className: 'sh-triggerLabel' }, tr('button')),
          ),
          open && anchor !== null
            ? createPortal === null
              ? panel
              : createPortal(panel, document.body)
            : null,
        );
      }

      ctx.slots.inject('conversation.input.left', () =>
        ctx.slots.register(
          {
            name: 'conversation.input.left',
            id: 'skill-hub',
            order: 20,
            locale: NS,
          },
          SkillHub,
        ),
      );
    }

    return { inject, apply };
  },
});
