# BetterSkillManager (`better-skill-manager`)

[中文说明](README.zh.md)

A persistent [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web plugin that adds a **Skill / 技能** button beside the composer's permission control. It turns the session's skill catalog into a searchable panel and adds workspace- and user-level skill management to the Web GUI.

> 中文简介：在 DSH 输入框权限按钮旁添加一个 Skill 按钮，用于查看、筛选、导入、编辑和移动当前工作区与用户级技能。

**Status:** `1.2.0` preview. Validated against DeepSeek Harness `0.2.2-rc.1` on Windows with Host helper tests and a Client render/flow test; not a full browser end-to-end suite.

Developed with the assistance of **DeepSeek-V4.1-flash** and **GPT-6.1-Sol**（借助DeepSeek-V4.1-flash与GPT-6.1-Sol开发）。

## Features

### Browse and invoke

- A **Skill** button in the composer tool row, immediately after the permission and plan controls.
- Two tabs: **当前工作区会话 / Workspace sessions** and **用户级 / User-level**.
- Main tags **内置 / 用户 / 会话**. Selecting one reveals that group's sub-tags in a second row, one group at a time; **全部** clears only the sub-tag, and **清除筛选** resets both.
- Search matches names, descriptions, `whenToUse`, and tags.
- Rows are rounded cards that grow on hover. Clicking a row inserts `/name ` into the draft, using the native skill invocation path; **查看 / View** opens the `SKILL.md` in the right Sidebar.
- **Provenance**: skills created or imported through the panel carry `managed-by: skill-hub` in their frontmatter. Skills added outside the panel (hand-written files, `git`, another tool or agent) automatically get a derived **其他途径来源 / Other source** sub-tag under their main tag.
- Tags are stored in the skill's own `SKILL.md` frontmatter (`tags: ["..."]`).

### Add and import

- The header **添加 / Add** button opens the import form:
  - **Name**
  - **Tags**
  - **Scope**: 当前工作区会话 / 用户级
  - **Skill file**: drag & drop a `SKILL.md` or a skill folder, choose a `.md` from disk, or paste a raw file / GitHub / Gitee URL.
- The exact source hint:

  > 可以是拖入也可以从硬盘选择，也可以GitHub，gitee这种开源平台的skill的所在地址

- Accepted addresses include raw `.md` files, `github.com/.../blob/...`, `github.com/.../tree/...`, repository roots, and the equivalent Gitee forms.
- The Host resolves the address to a raw file, fetches it, synchronizes the frontmatter name and tags, and writes the skill into the chosen scope.
- Address imports accept only public HTTP(S). IPv4/IPv6 private, loopback, link-local, IPv4-mapped, credential URLs, and hosts that resolve to a private address are rejected. The composed `web` service's policy errors (redirect, cross-origin, size, cancellation) are final; the native fetch is used only when no `web` service exists, and then it follows redirects manually with a per-hop address check and a byte cap.

### Edit and move

The editor has four modules:

1. **名称 / Name** — renames the skill directory or flat file and rewrites the `name` field.
2. **标签 / Tags** — add or remove `#tags`, with common tags offered as quick-add chips.
3. **作用范围 / Scope** — move the skill between:
   - **当前工作区会话** — `<projectRoot>/.dsh/skills` or `<projectRoot>/.agents/skills` (the nearest `.git` ancestor of the session cwd, else the cwd); shared by sessions in that workspace.
   - **用户级** — `<dshHome>/skills` or `<dshAgentsHome>/skills`; available to every session.
4. **文件内容 / File content** — the complete `SKILL.md`, including frontmatter.

Editing keeps the storage root the file already uses. A skill in `~/.agents/skills` is not moved to `~/.dsh/skills` just because you changed its tags; only an explicit scope change moves it. A save whose loaded content changed on disk is rejected with a conflict message instead of overwriting. The editor hashes the exact bytes returned by `workspaceFiles.readBytes`, so LF/CRLF and trailing-newline differences do not create a false conflict.

Moves preserve bundle resources (`references/`, `scripts/`, …). Deleting removes the whole skill bundle.

### Safety notes

- **No save after a failed read.** The editor shows **重新读取 / Reload** and a cancel action; there is no save button until a complete read succeeds. The Host independently requires frontmatter with a non-empty `name` and `description` and refuses empty content.
- **A failed replace never deletes the original.** Updates write a temporary sibling and rename it over the target, with bounded retries for transient Windows locks. If the rename still fails, the original stays and the save reports an error. Exclusive creates use `wx`, so an externally created target is never overwritten. Moves are rolled back where possible; there is no write-ahead log, undo, or cross-device transaction.
- **YAML is checked with a conservative subset.** Unclosed quotes, unbalanced flow brackets, and tab indentation are rejected before writing. Multi-line tags are preserved when unchanged and replaced as a whole when changed; block scalar descriptions are preserved; a block scalar `name` or `tags` rewrite is rejected. This is not a full YAML parser, so the UI can still reject a valid construct outside the subset instead of rewriting it.
- **Address imports are pre-flight checked only.** The plugin rejects private/resolved-private targets before a candidate is fetched, and the composed `web` service's policy errors are final. The service resolves and connects with its own transport policy, so DNS rebinding between the check and that connection is not prevented by this plugin; the deployment's network isolation remains the boundary.
- **Import tags are preserved unless you edit them.** If the tag module was untouched, the Host keeps the source document's tags (including a URL import it fetched itself); clearing every tag in the form sends an explicit empty list.
- **A successful write and a stale catalog are reported separately.** If the bounded refresh poll never observes the write, the panel says the file was written but the catalog has not updated and leaves **刷新 / Refresh** available.
- **Unknown provider roots are read-only.** The Host publishes only the user and project roots; a skill from a custom provider or another plugin root is classified as built-in.
- **A read failure is unknown provenance, not “other source”.** The derived provenance tag is only added after a successful head read shows no `managed-by` marker.

## Install

Requirements:

- A DSH Web/Desktop profile with the conversation composer and the `skills` service (the shipped `desktop` and `web` profiles include them).
- No build step: the package is plain ES modules plus a prebuilt Client bundle.

Install this folder as a bundle:

1. Clone or download the repository.
2. In DSH, open **Plugins** (Plugin Manager) and install the local folder, or run `plugin_manager` with `install_bundle` and this folder as the target.
3. Make sure the `better-skill-manager` bundle is enabled. Its row id is `better-skill-manager`.

The package is marked `"private": true` to prevent accidental npm publishes. Remove that field if you intend to publish it under your own npm scope or name.

## Usage

1. Open any session and click **技能 / Skills** next to the permission control.
2. Pick a main tag, then an optional sub-tag, or use the search box.
3. Click a skill row to stage `/name ` in the composer, or **查看** to inspect its `SKILL.md`.
4. Use **添加** to import a skill, or **编辑** to rename, re-tag, move, or rewrite one.

## How it works

- The Client half (`client.js`) registers into `conversation.input.left`, reads the session catalog through `ctx.remote.skills.list({ sessionId })`, reads the frontmatter of editable skills with `workspaceFiles.read` (first 200 lines) for tags and provenance, inserts `/name` with `inputActions`, and opens files through `ctx.sidebarRight.openResource(...)`. It asks the Host for the visible roots through `roots` instead of guessing them from path strings.
- The Host half (`index.js`) registers `/skill-hub` (`recordInput: false`) with `roots`, `create`, `import`, `save`, and `delete`. It accepts only a root-level flat Markdown file or a direct child bundle's `SKILL.md`, verifies the real file (a symlink is rejected), serializes mutations, and writes updates through a temporary sibling while creating new files with exclusive `wx`. A save can carry the content hash it loaded; a mismatch is rejected as an external change.
- Address imports fetch outside the write queue. Only public HTTP(S) is accepted; the composed `web` service's policy errors are final, and the native fallback is used only when that service is absent.
- The panel uses a fixed height and fades its content on tab changes; it does not resize when a tab has fewer skills.

## Compatibility and known conflicts

**No conflicting plugins have been found so far** in the development profile.
This plugin registers one composer control and writes only skill files under
the roots it reports. It may still conflict with the following types of
plugins:

- **Other composer-slot plugins** registering into `conversation.input.left`
  with the same id/order, or replacing the composer tool row: duplicate buttons
  or layout overlap.
- **Other skill managers** that write, move, rename, or delete files under
  `$DSH_HOME/skills`, `$DSH_AGENTS_HOME/skills`, `<projectRoot>/.dsh/skills`, or
  `<projectRoot>/.agents/skills`: cross-plugin writes are not locked. The
  content-hash check rejects a save after an external change, but it does not
  coordinate concurrent moves.
- **Plugins providing a custom `skills` provider or a different catalog**
  (runtime/pathless skills, custom roots): those skills appear read-only or
  built-in here, and a same-name skill can shadow or duplicate a filesystem one.
- **Plugins that replace or shadow the `skill` tool or the system-prompt skill
  catalog**: the panel may list a skill that the model's tool cannot load, or
  the reverse.
- **Plugins attaching document-level drag/drop or file-paste handlers on the
  composer**: while the import form is open this plugin captures drags over the
  panel; another drop zone may compete for the same gesture. Outside the import
  form it does not intercept drags.
- **Plugins that rewrite `SKILL.md` frontmatter/tags** without preserving
  `managed-by`, or that rewrite a block scalar `name`: provenance tags or saves
  may be rejected or rewritten by the other side.
- **Plugins globally intercepting `Escape` or keyboard shortcuts**, or portaling
  overlays above the composer: focus, Escape handling, or z-index can conflict.
  This plugin only listens while its panel is open.
- **Theme/CSS plugins** overriding popover background, `backdrop-filter`, or
  z-index: a visual-only conflict, not a data conflict.
- **Another copy of this plugin** installed under a different package/row id but
  pointed at the same skill roots: both panels can edit the same files; keep one
  copy enabled at a time.

## Privacy

This repository is intended to contain only plugin source, documentation, and an original icon. No credentials or API keys are stored in the code.

The plugin reads skill files under the configured DSH home, workspace project roots, and the addresses you explicitly provide. It does not collect or transmit telemetry.

Before the first public commit, review the staged files and your git identity: documentation can still refer to local path variables such as `$DSH_HOME`, and a commit carries the author name/email configured on your machine. This README is not a guarantee that every future change stays free of sensitive data.

## Limitations

- **Workspace scope is shared by sessions in the same workspace.** “当前工作区会话” is the project skill root, not per-session isolation. Strict single-session isolation is not implemented.
- **Built-in and unknown-provider skills are read-only** — no edit, delete, or tag actions.
- **Imports copy `SKILL.md` only.** A dropped folder's `references/`, `scripts/`, etc. are not copied, and an address import reads one file.
- **Address imports need a direct file or a supported GitHub/Gitee URL form.** A repository page that does not expose a root `SKILL.md` or a tree path at the skill directory cannot be resolved.
- **YAML support is a conservative subset.** Unclosed quotes, unbalanced flow brackets, and tab indentation are rejected; a block scalar `name`/`tags` rewrite is rejected; block scalar descriptions are preserved. There is no full YAML parser.
- **No full transaction or undo.** Writes use temporary files and a best-effort rollback, but a crash between a move and its write can still leave a recoverable intermediate state.
- **A focused Host helper test suite is included.** `npm test` runs `test/host.test.mjs`; `npm run check` syntax-checks both halves. There is no browser end-to-end suite or CI workflow yet.
- **Catalog refreshes poll `skills/list`** after a write; the filesystem watcher is asynchronous.
- Saves append the normal `/skill-hub` command lifecycle rows to the session log; the payload itself is not recorded. The read-only `roots` call also appears as a command row once per panel session.

## License

[MIT](LICENSE)
