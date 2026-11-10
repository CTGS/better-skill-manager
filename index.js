/**
 * BetterSkillManager — host half.
 *
 * Registers the `/skill-hub` human command used by the composer panel to
 * create, import, edit, rename, move, and delete skill files.
 *
 * Editable locations:
 *   - user:    `$DSH_HOME/skills` and `$DSH_AGENTS_HOME/skills`
 *   - project: `<projectRoot>/.dsh/skills` and `<projectRoot>/.agents/skills`
 *     where projectRoot is the nearest `.git` ancestor of the session cwd,
 *     else the cwd.
 *
 * A skill is editable only as a flat `<root>/<name>.md` or a bundle
 * `<root>/<name>/SKILL.md` directly under one of those roots. Nested Markdown
 * resources are never accepted as skills.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import dns from 'node:dns/promises';
import net from 'node:net';

/** Kebab-case skill name accepted by the filesystem skill provider. */
const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_TEXT = 262144;
const MAX_DESCRIPTION = 4000;
const MAX_WHEN = 2000;
const MAX_TAGS = 12;
const MAX_TAG_LENGTH = 24;
const MAX_REDIRECTS = 5;
const FETCH_TIMEOUT_MS = 15000;
const RESERVED_TAGS = new Set(['内置', '用户', '其他途径来源', 'Other source']);

function dshHome() {
  return process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
}

function agentsHome() {
  return process.env.DSH_AGENTS_HOME || path.join(os.homedir(), '.agents');
}

function userSkillRoots() {
  return [path.join(dshHome(), 'skills'), path.join(agentsHome(), 'skills')];
}

function insideRoot(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function exists(target) {
  try {
    await fs.lstat(target);
    return true;
  } catch {
    return false;
  }
}

async function findProjectRoot(cwd) {
  if (typeof cwd !== 'string' || cwd.length === 0) return undefined;
  let current = path.resolve(cwd);
  for (;;) {
    if (await exists(path.join(current, '.git'))) return current;
    const parent = path.dirname(current);
    if (parent === current) return path.resolve(cwd);
    current = parent;
  }
}

async function projectSkillRoots(cwd) {
  const root = await findProjectRoot(cwd);
  if (root === undefined) return [];
  return [path.join(root, '.dsh', 'skills'), path.join(root, '.agents', 'skills')];
}

function uniqueRoots(roots) {
  const seen = new Set();
  const result = [];
  for (const root of roots) {
    const resolved = path.resolve(root);
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    result.push(resolved);
  }
  return result;
}

async function allSkillRoots(cwd) {
  return uniqueRoots([...userSkillRoots(), ...(await projectSkillRoots(cwd))]);
}

/**
 * Resolve a path to a supported skill layout directly under `root`.
 * Flat:  <root>/<name>.md
 * Bundle: <root>/<name>/SKILL.md
 */
function skillLayout(root, absolute) {
  const relative = path.relative(path.resolve(root), path.resolve(absolute));
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) return undefined;
  const segments = relative.split(path.sep);
  if (segments.length === 1 && /\.md$/iu.test(segments[0]) && segments[0].toLowerCase() !== 'skill.md') {
    return { kind: 'flat' };
  }
  if (segments.length === 2 && segments[1] === 'SKILL.md' && segments[0].length > 0) {
    return { kind: 'bundle' };
  }
  return undefined;
}

/** The source must be an existing regular file (a symlink is rejected). */
async function realFileWithin(root, absolute) {
  const info = await fs.lstat(absolute).catch(() => undefined);
  if (info === undefined || !info.isFile()) return false;
  const realRoot = await fs.realpath(root).catch(() => path.resolve(root));
  const realFile = await fs.realpath(absolute).catch(() => undefined);
  return realFile !== undefined && insideRoot(realRoot, realFile);
}

async function allowedSkill(value, cwd) {
  if (typeof value !== 'string' || value.length === 0) return undefined;
  const absolute = path.resolve(value);
  const roots = await allSkillRoots(cwd);
  const userRoots = userSkillRoots().map((root) => path.resolve(root));
  for (const root of roots) {
    const layout = skillLayout(root, absolute);
    if (layout === undefined) continue;
    if (!(await realFileWithin(root, absolute))) continue;
    return {
      path: absolute,
      root,
      scope: userRoots.includes(root) ? 'user' : 'session',
      layout: layout.kind,
    };
  }
  return undefined;
}

function text(value, label, max) {
  if (typeof value !== 'string') throw new Error(`${label} must be a string`);
  if (value.length > max) throw new Error(`${label} is too long`);
  return value;
}

function skillName(value) {
  const name = text(value, 'name', 120).trim();
  if (!NAME_PATTERN.test(name)) throw new Error('name must be kebab-case (letters, digits, single hyphens)');
  return name;
}

function stripTag(value) {
  return String(value ?? '')
    .trim()
    .replace(/^#+/u, '')
    .replace(/^['"]|['"]$/gu, '')
    .trim();
}

function normalizeTags(value) {
  const list = [];
  for (const item of Array.isArray(value) ? value : []) {
    if (typeof item !== 'string') continue;
    const tag = stripTag(item);
    if (tag.length === 0 || tag.length > MAX_TAG_LENGTH || RESERVED_TAGS.has(tag)) continue;
    if (!list.includes(tag)) list.push(tag);
    if (list.length >= MAX_TAGS) break;
  }
  return list;
}

function skillNameOfPath(file) {
  return path.basename(file) === 'SKILL.md'
    ? path.basename(path.dirname(file))
    : path.basename(file, path.extname(file));
}

function buildSkillFile({ name, description, whenToUse, body, tags }) {
  const lines = [
    '---',
    `name: ${JSON.stringify(name)}`,
    `description: ${JSON.stringify(description)}`,
    'managed-by: "skill-hub"',
  ];
  if (typeof whenToUse === 'string' && whenToUse.trim().length > 0) {
    lines.push(`whenToUse: ${JSON.stringify(whenToUse.trim())}`);
  }
  if (Array.isArray(tags) && tags.length > 0) lines.push(`tags: ${JSON.stringify(tags)}`);
  lines.push('---', '', String(body ?? '').replace(/\s+$/u, ''), '');
  return lines.join('\n');
}

function frontmatterField(content, field) {
  const lines = String(content).replace(/\r\n/gu, '\n').split('\n');
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
        return JSON.parse(raw);
      } catch {
        return raw.replace(/^"|"$/gu, '');
      }
    }
    if (raw.startsWith("'")) return raw.replace(/^'|'$/gu, '');
    return raw;
  }
  return undefined;
}

function insertFrontmatterField(content, field, value) {
  const lines = String(content).replace(/\r\n/gu, '\n').split('\n');
  if (lines[0]?.trim() !== '---') return content;
  let end = -1;
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index].trim() === '---') {
      end = index;
      break;
    }
  }
  if (end < 0) return content;
  lines.splice(1, 0, `${field}: ${JSON.stringify(value)}`);
  return lines.join('\n');
}

function deriveDescription(content, name) {
  const lines = String(content).replace(/\r\n/gu, '\n').split('\n');
  let start = 0;
  if (lines[0]?.trim() === '---') {
    for (let index = 1; index < lines.length; index += 1) {
      if (lines[index].trim() === '---') {
        start = index + 1;
        break;
      }
    }
  }
  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (line.length === 0) continue;
    const plain = line.replace(/^#+\s*/u, '').trim();
    if (plain.length > 0) return plain.slice(0, 200);
  }
  return name;
}

/** Locate the frontmatter fences, if present. */
function frontmatterBounds(content) {
  const lines = String(content).replace(/\r\n/gu, '\n').split('\n');
  if (lines[0]?.trim() !== '---') return undefined;
  let end = -1;
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index].trim() === '---') {
      end = index;
      break;
    }
  }
  return end < 0 ? undefined : { lines, end };
}

/** Bracket depth outside quoted scalars and comments. */
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

/**
 * Reject frontmatter this patcher cannot rewrite without changing meaning.
 * This is a conservative subset, not a complete YAML parser: it checks quotes,
 * flow brackets, tab indentation, and block scalar boundaries, and the patcher
 * only rewrites simple name/tags entries.
 */
function assertSafeFrontmatter(content) {
  const bounds = frontmatterBounds(content);
  if (bounds === undefined) return;
  const { lines, end } = bounds;
  let depth = 0;
  let blockIndent = null;
  for (let index = 1; index < end; index += 1) {
    const raw = lines[index];
    const indent = (/^ */u.exec(raw) ?? [''])[0].length;
    if (/^\t/u.test(raw)) throw new Error('tab indentation in the frontmatter is not supported');
    if (blockIndent !== null) {
      if (raw.trim().length === 0 || indent > blockIndent) continue;
      blockIndent = null;
    }
    if (/^\s*[A-Za-z0-9_.-]+\s*:\s*[>|][+-]?\s*(?:#.*)?$/u.test(raw)) {
      blockIndent = indent;
      continue;
    }
    let text = '';
    let quote = null;
    for (let cursor = 0; cursor < raw.length; cursor += 1) {
      const character = raw[cursor];
      if (quote !== null) {
        if (character === '\\' && quote === '"') cursor += 1;
        else if (character === quote) quote = null;
        continue;
      }
      if (character === '"' || character === "'") {
        quote = character;
        continue;
      }
      if (character === '#' && (cursor === 0 || /\s/u.test(raw[cursor - 1]))) break;
      text += character;
    }
    if (quote !== null) throw new Error('unterminated quoted scalar in the frontmatter');
    if (indent === 0) {
      const mapping = /^\s*([A-Za-z0-9_.-]+)\s*:(.*)$/u.exec(text);
      if (mapping !== null && !/^\s*[\[{]/u.test(mapping[2]) && /:\s/u.test(mapping[2])) {
        throw new Error('invalid unquoted mapping value in the frontmatter');
      }
    }
    for (const character of text) {
      if (character === '[' || character === '{') depth += 1;
      else if (character === ']' || character === '}') {
        depth -= 1;
        if (depth < 0) throw new Error('unbalanced flow collection in the frontmatter');
      }
    }
  }
  if (depth !== 0) throw new Error('unbalanced flow collection in the frontmatter');
}

/** End index (exclusive) of one top-level frontmatter entry. */
function frontmatterEntryEnd(lines, index, end) {
  const raw = lines[index];
  const value = raw
    .slice(raw.indexOf(':') + 1)
    .replace(/\s+#.*$/u, '')
    .trim();
  let next = index + 1;
  if (value.startsWith('[') || value.startsWith('{')) {
    let depth = flowDepth(value);
    while (depth > 0 && next < end) {
      depth += flowDepth(lines[next]);
      next += 1;
    }
    return next;
  }
  if (value.startsWith('|') || value.startsWith('>')) {
    throw new Error('block scalar frontmatter cannot be rewritten');
  }
  if (value.length === 0) {
    const keyIndent = (/^ */u.exec(raw) ?? [''])[0].length;
    while (next < end) {
      const line = lines[next];
      if (line.trim().length === 0) {
        next += 1;
        continue;
      }
      const indent = (/^ */u.exec(line) ?? [''])[0].length;
      if (indent <= keyIndent) break;
      if (/^\s*-\s+/u.test(line) || /^\s+\S/u.test(line)) {
        next += 1;
        continue;
      }
      break;
    }
    return next;
  }
  return next;
}

function patchFrontmatter(content, name, tags, options = {}) {
  const source = String(content);
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  const normalized = source.replace(/\r\n/gu, '\n');
  assertSafeFrontmatter(normalized);
  const nameChanged = options.nameChanged !== false;
  const tagsChanged = options.tagsChanged !== false;
  const bounds = frontmatterBounds(normalized);
  if (bounds === undefined) {
    const header = ['---', `name: ${JSON.stringify(name)}`];
    if (tags.length > 0) header.push(`tags: ${JSON.stringify(tags)}`);
    header.push('---', '');
    return header.join(eol) + normalized;
  }
  const { lines, end } = bounds;
  const front = lines.slice(1, end);
  const kept = [];
  for (let index = 0; index < front.length; index += 1) {
    const line = front[index];
    if (nameChanged && /^name\s*:/u.test(line)) {
      index = frontmatterEntryEnd(front, index, front.length) - 1;
      continue;
    }
    if (tagsChanged && /^tags\s*:/u.test(line)) {
      index = frontmatterEntryEnd(front, index, front.length) - 1;
      continue;
    }
    kept.push(line);
  }
  const additions = [];
  if (nameChanged) additions.push(`name: ${JSON.stringify(name)}`);
  if (tagsChanged && tags.length > 0) additions.push(`tags: ${JSON.stringify(tags)}`);
  const next = ['---', ...additions, ...kept, '---', ...lines.slice(end + 1)].join(eol);
  assertSafeFrontmatter(next);
  return next;
}

/** The final file must be a valid Harness skill: frontmatter with name and description. */
function validateSkillContent(content) {
  assertSafeFrontmatter(content);
  const name = frontmatterField(content, 'name');
  const description = frontmatterField(content, 'description');
  if (typeof name !== 'string' || name.length === 0) throw new Error('the skill file is missing a name');
  if (/^[>|]/u.test(name)) throw new Error('block scalar name frontmatter is not supported');
  if (!NAME_PATTERN.test(name)) throw new Error('invalid skill name in the file');
  if (typeof description !== 'string' || description.length === 0) {
    throw new Error('the skill file is missing a description');
  }
}

function importContent(raw, name, tags, tagsSpecified = true) {
  const value = String(raw).replace(/^\uFEFF/u, '').replace(/\r\n/gu, '\n').trim();
  if (value.length === 0) throw new Error('the imported file is empty');
  if (value.split('\n', 1)[0]?.trim() !== '---') {
    return buildSkillFile({
      name,
      description: deriveDescription(value, name),
      whenToUse: '',
      body: value,
      tags: tagsSpecified ? tags : [],
    });
  }
  const description = frontmatterField(value, 'description') ?? deriveDescription(value, name);
  let patched = patchFrontmatter(value, name, tags, {
    nameChanged: true,
    tagsChanged: tagsSpecified,
  });
  if (frontmatterField(patched, 'description') === undefined) {
    patched = insertFrontmatterField(patched, 'description', description);
  }
  if (frontmatterField(patched, 'managed-by') === undefined) {
    patched = insertFrontmatterField(patched, 'managed-by', 'skill-hub');
  }
  return patched;
}

/** Stable non-cryptographic content identity used for conflict detection. */
function contentHash(content) {
  let hash = 2166136261;
  for (const byte of Buffer.from(String(content ?? ''), 'utf8')) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

/** Write through a temporary file so a failed write never truncates the target. */
async function writeAtomic(file, content, options = {}) {
  const directory = path.dirname(file);
  await fs.mkdir(directory, { recursive: true });
  if (options.exclusive === true) {
    try {
      // `wx` is the commit: an existing target is never opened or replaced.
      await fs.writeFile(file, content, { encoding: 'utf8', flag: 'wx' });
    } catch (error) {
      if (error && error.code !== 'EEXIST') {
        // The exclusive create owns this path; do not leave a partial file.
        await fs.rm(file, { force: true }).catch(() => {});
      }
      throw error;
    }
    return;
  }
  const temp = path.join(directory, `.${path.basename(file)}.${randomUUID()}.tmp`);
  await fs.writeFile(temp, content, { encoding: 'utf8', flag: 'wx' });
  let lastError;
  for (let attempt = 0; attempt < 7; attempt += 1) {
    try {
      await fs.rename(temp, file);
      return;
    } catch (error) {
      lastError = error;
      // Windows can report a transient lock while another process closes the
      // target. Retrying keeps the original untouched until the rename works.
      if (!error || !['EACCES', 'EBUSY', 'EPERM'].includes(error.code)) break;
      await new Promise((resolve) => setTimeout(resolve, 40 * 2 ** attempt));
    }
  }
  await fs.rm(temp, { force: true }).catch(() => {});
  throw lastError;
}

async function movePath(from, to) {
  try {
    await fs.rename(from, to);
    return;
  } catch (error) {
    if (!error || error.code !== 'EXDEV') throw error;
  }
  await fs.cp(from, to, { recursive: true });
  await fs.rm(from, { recursive: true, force: true });
}

/** Check both supported layouts for a name in the given roots. */
async function checkConflict(name, roots, ignore = new Set()) {
  for (const root of roots) {
    for (const candidate of [path.join(root, name), path.join(root, `${name}.md`)]) {
      if (ignore.has(path.resolve(candidate))) continue;
      if (await exists(candidate)) return candidate;
    }
  }
  return undefined;
}

function sourceIgnore(source) {
  const ignore = new Set([path.resolve(source.path)]);
  if (source.layout === 'bundle') ignore.add(path.resolve(path.dirname(source.path)));
  return ignore;
}

function sessionCwd(ctx, invocation) {
  const service = ctx.get('workingDirectory');
  if (service === undefined) return undefined;
  try {
    return service.get(invocation.agent.session);
  } catch {
    return undefined;
  }
}

function isPrivateIPv4(address) {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}

function isPrivateAddress(address) {
  const value = String(address).toLowerCase();
  if (net.isIPv4(value)) return isPrivateIPv4(value);
  if (net.isIPv6(value)) {
    if (value === '::' || value === '::1') return true;
    if (value.startsWith('::ffff:')) return true;
    if (/^f[cd]/u.test(value)) return true;
    if (/^fe[89ab]/u.test(value)) return true;
    return false;
  }
  return true;
}

async function assertPublicUrl(value, signal) {
  signal?.throwIfAborted();
  let url;
  try {
    url = new URL(String(value).trim());
  } catch {
    throw new Error('the address must be an http(s) URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('the address must be an http(s) URL');
  }
  if (url.username.length > 0 || url.password.length > 0) {
    throw new Error('credentials in the address are not allowed');
  }
  const host = url.hostname.replace(/^\[|\]$/gu, '');
  if (net.isIP(host)) {
    if (isPrivateAddress(host)) throw new Error('the address points to a private network');
    return url;
  }
  let records;
  try {
    records = await new Promise((resolve, reject) => {
      let settled = false;
      const cleanup = signal === undefined ? undefined : () => signal.removeEventListener('abort', onAbort);
      const finish = (callback, result) => {
        if (settled) return;
        settled = true;
        cleanup?.();
        callback(result);
      };
      const onAbort = () => finish(reject, new Error('the import was cancelled'));
      if (signal !== undefined) {
        if (signal.aborted) {
          onAbort();
          return;
        }
        signal.addEventListener('abort', onAbort, { once: true });
      }
      dns.lookup(host, { all: true }).then(
        (value) => finish(resolve, value),
        (error) => finish(reject, error),
      );
    });
  } catch (error) {
    if (signal?.aborted === true) throw new Error('the import was cancelled');
    throw error;
  }
  if (records.length === 0) throw new Error('could not resolve the address');
  for (const record of records) {
    if (isPrivateAddress(record.address)) throw new Error('the address resolves to a private network');
  }
  return url;
}

function sourceCandidates(input) {
  let url;
  try {
    url = new URL(String(input).trim());
  } catch {
    return [];
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return [];
  const list = [];
  const push = (value) => {
    if (!list.includes(value)) list.push(value);
  };
  const host = url.hostname.toLowerCase();
  const parts = url.pathname
    .split('/')
    .filter(Boolean)
    .map((part) => decodeURIComponent(part));
  if (host === 'raw.githubusercontent.com') {
    push(url.toString());
    return list;
  }
  if (host === 'github.com' && parts.length >= 2) {
    const [owner, repo, kind, branch, ...rest] = parts;
    if (kind === 'blob' && branch !== undefined && rest.length > 0) {
      push(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${rest.join('/')}`);
    } else if (kind === 'tree' && branch !== undefined) {
      const base = rest.length > 0 ? `${rest.join('/')}/` : '';
      push(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${base}SKILL.md`);
    } else if (kind === undefined) {
      for (const candidate of ['main', 'master', 'HEAD']) {
        push(`https://raw.githubusercontent.com/${owner}/${repo}/${candidate}/SKILL.md`);
      }
    }
    return list;
  }
  if (host === 'gitee.com' && parts.length >= 2) {
    const [owner, repo, kind, branch, ...rest] = parts;
    if (kind === 'raw') {
      push(url.toString());
    } else if (kind === 'blob' && branch !== undefined && rest.length > 0) {
      push(`https://gitee.com/${owner}/${repo}/raw/${branch}/${rest.join('/')}`);
    } else if (kind === 'tree' && branch !== undefined) {
      const base = rest.length > 0 ? `${rest.join('/')}/` : '';
      push(`https://gitee.com/${owner}/${repo}/raw/${branch}/${base}SKILL.md`);
    } else if (kind === undefined) {
      for (const candidate of ['master', 'main', 'HEAD']) {
        push(`https://gitee.com/${owner}/${repo}/raw/${candidate}/SKILL.md`);
      }
    }
    return list;
  }
  push(url.toString());
  return list;
}

async function nativeFetchText(url, signal) {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    await assertPublicUrl(current, signal);
    const response = await fetch(current, { signal, redirect: 'manual' });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (location === null || location.length === 0) throw new Error('redirect without a location');
      await response.body?.cancel().catch(() => {});
      current = new URL(location, current).toString();
      continue;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (response.body === null) return await response.text();
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let output = '';
    let bytes = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_TEXT) {
        await reader.cancel().catch(() => {});
        throw new Error('the imported file is too large');
      }
      output += decoder.decode(value, { stream: true });
    }
    output += decoder.decode();
    return output;
  }
  throw new Error('too many redirects');
}

async function fetchText(ctx, url, signal) {
  const web = ctx.get('web');
  if (web !== undefined) {
    // The composed service applies the deployment's network policy. Its
    // rejections (redirect policy, size, cancellation) are final; never
    // retry them with a permissive native fetch.
    const result = await web.fetch({ url }, signal);
    if (result.statusCode < 200 || result.statusCode >= 300) {
      throw new Error(`HTTP ${result.statusCode}`);
    }
    if (result.truncated) throw new Error('the imported file is too large');
    if (result.body.kind !== 'text') throw new Error('the address did not return a text file');
    if (result.body.content.length > MAX_TEXT) throw new Error('the imported file is too large');
    return result.body.content;
  }
  return await nativeFetchText(url, signal);
}

async function fetchSkillSource(ctx, sourceUrl) {
  const candidates = sourceCandidates(sourceUrl);
  if (candidates.length === 0) throw new Error('the address must be an http(s) URL');
  // One deadline covers DNS, every redirect, and the body read.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    for (const candidate of candidates) {
      controller.signal.throwIfAborted();
      await assertPublicUrl(candidate, controller.signal);
      try {
        const content = await fetchText(ctx, candidate, controller.signal);
        if (typeof content === 'string' && content.trim().length > 0) {
          if (content.length > MAX_TEXT) throw new Error('the imported file is too large');
          return content;
        }
      } catch (error) {
        if (
          error instanceof Error &&
          /too[ _-]?large|private network|credentials|http\(s\)|resolve|redirect|blocked|cross-origin|cancel|abort/iu.test(error.message)
        ) {
          throw error;
        }
      }
    }
  } finally {
    clearTimeout(timer);
  }
  throw new Error('could not read a SKILL.md from that address');
}

async function createSkill(payload, cwd) {
  const name = skillName(payload.name);
  const description = text(payload.description, 'description', MAX_DESCRIPTION).trim();
  if (description.length === 0) throw new Error('description must not be empty');
  const whenToUse = typeof payload.whenToUse === 'string' ? payload.whenToUse.trim() : '';
  if (whenToUse.length > MAX_WHEN) throw new Error('whenToUse is too long');
  const body = typeof payload.body === 'string' ? payload.body : '';
  if (body.length > MAX_TEXT) throw new Error('body is too long');
  const tags = normalizeTags(payload.tags);
  const scope = payload.scope === 'session' ? 'session' : 'user';
  const project = await projectSkillRoots(cwd);
  const root = scope === 'session' ? project[0] : path.join(dshHome(), 'skills');
  if (root === undefined) return { kind: 'error', text: 'The current session has no working directory.' };

  if (await checkConflict(name, await allSkillRoots(cwd))) {
    return { kind: 'error', text: `A skill named "${name}" already exists.` };
  }

  const content = buildSkillFile({ name, description, whenToUse, body, tags });
  validateSkillContent(content);
  const file = path.join(root, name, 'SKILL.md');
  try {
    await writeAtomic(file, content, { exclusive: true });
  } catch (error) {
    if (error && (error.code === 'EEXIST' || error.code === 'EPERM')) {
      return { kind: 'error', text: `A skill named "${name}" already exists.` };
    }
    throw error;
  }
  return { kind: 'success', text: JSON.stringify({ path: file, name, scope, tags }) };
}

async function importSkill(payload, cwd) {
  const name = skillName(payload.name);
  const tagsSpecified = Array.isArray(payload.tags);
  const tags = tagsSpecified ? normalizeTags(payload.tags) : [];
  const scope = payload.scope === 'session' ? 'session' : 'user';
  const project = await projectSkillRoots(cwd);
  const root = scope === 'session' ? project[0] : path.join(dshHome(), 'skills');
  if (root === undefined) return { kind: 'error', text: 'The current session has no working directory.' };

  if (await checkConflict(name, await allSkillRoots(cwd))) {
    return { kind: 'error', text: `A skill named "${name}" already exists.` };
  }

  const raw = typeof payload.content === 'string' ? payload.content : '';
  if (raw.trim().length === 0) return { kind: 'error', text: 'The imported file is empty.' };
  if (raw.length > MAX_TEXT) throw new Error('the imported file is too large');
  const content = importContent(raw, name, tags, tagsSpecified);
  validateSkillContent(content);
  const file = path.join(root, name, 'SKILL.md');
  try {
    await writeAtomic(file, content, { exclusive: true });
  } catch (error) {
    if (error && (error.code === 'EEXIST' || error.code === 'EPERM')) {
      return { kind: 'error', text: `A skill named "${name}" already exists.` };
    }
    throw error;
  }
  return { kind: 'success', text: JSON.stringify({ path: file, name, scope, tags }) };
}

async function saveSkill(payload, cwd) {
  const source = await allowedSkill(payload.path, cwd);
  if (source === undefined) {
    return { kind: 'error', text: 'Only a top-level skill file or its SKILL.md can be edited.' };
  }
  const name = skillName(payload.name);
  const content = text(payload.content, 'content', MAX_TEXT);
  if (content.trim().length === 0) {
    return { kind: 'error', text: 'The skill file content is empty; refusing to save over the original.' };
  }
  const tags = normalizeTags(payload.tags);

  const current = await fs.readFile(source.path, 'utf8');
  if (typeof payload.baseHash === 'string' && payload.baseHash.length > 0) {
    if (contentHash(current) !== payload.baseHash) {
      return {
        kind: 'error',
        text: 'The skill file changed outside this panel. Reload it before saving.',
      };
    }
  }

  const requestedScope =
    payload.scope === 'session' ? 'session' : payload.scope === 'user' ? 'user' : source.scope;
  const movingScope = requestedScope !== source.scope;
  let root = source.root;
  if (movingScope) {
    root = requestedScope === 'session'
      ? (await projectSkillRoots(cwd))[0]
      : path.join(dshHome(), 'skills');
  }
  if (root === undefined) return { kind: 'error', text: 'The current session has no working directory.' };

  const isBundle = source.layout === 'bundle';
  const target = isBundle ? path.join(root, name, 'SKILL.md') : path.join(root, `${name}.md`);
  const sameFile = path.resolve(target) === path.resolve(source.path);
  if (!sameFile) {
    const conflict = await checkConflict(name, [root], sourceIgnore(source));
    if (conflict !== undefined) {
      return { kind: 'error', text: `"${name}" already exists in that scope.` };
    }
  }

  const nextContent = patchFrontmatter(content, name, tags, {
    nameChanged: payload.nameChanged !== false,
    tagsChanged: payload.tagsChanged !== false,
  });
  validateSkillContent(nextContent);

  if (sameFile) {
    await writeAtomic(target, nextContent);
  } else if (isBundle) {
    const sourceDir = path.dirname(source.path);
    const targetDir = path.dirname(target);
    await fs.mkdir(root, { recursive: true });
    await movePath(sourceDir, targetDir);
    try {
      await writeAtomic(target, nextContent);
    } catch (error) {
      await fs.writeFile(target, current, 'utf8').catch(() => {});
      await movePath(targetDir, sourceDir).catch(() => {});
      throw error;
    }
  } else {
    await fs.mkdir(root, { recursive: true });
    await writeAtomic(target, nextContent);
    try {
      await fs.unlink(source.path);
    } catch (error) {
      await fs.rm(target, { force: true }).catch(() => {});
      throw new Error('the new file was written but the old file could not be removed');
    }
  }
  return { kind: 'success', text: JSON.stringify({ path: target, name, scope: requestedScope, tags }) };
}

async function deleteSkill(payload, cwd) {
  const source = await allowedSkill(payload.path, cwd);
  if (source === undefined) {
    return { kind: 'error', text: 'Only a top-level skill file or its SKILL.md can be deleted.' };
  }
  if (source.layout === 'bundle') {
    await fs.rm(path.dirname(source.path), { recursive: true, force: true });
  } else {
    await fs.unlink(source.path);
  }
  return {
    kind: 'success',
    text: JSON.stringify({ name: typeof payload.name === 'string' ? payload.name : skillNameOfPath(source.path) }),
  };
}

async function handle(invocation, ctx) {
  let payload;
  try {
    payload = JSON.parse((invocation.rawInput || '').trim() || '{}');
  } catch {
    return { kind: 'error', text: 'skill-hub: invalid JSON payload' };
  }
  if (typeof payload !== 'object' || payload === null) {
    return { kind: 'error', text: 'skill-hub: payload must be an object' };
  }
  if (payload.op === undefined) {
    return { kind: 'success', text: 'Skill hub: open the composer Skill panel to manage skills.' };
  }
  const cwd = sessionCwd(ctx, invocation);
  try {
    switch (payload.op) {
      case 'roots':
        return {
          kind: 'success',
          text: JSON.stringify({
            user: userSkillRoots(),
            project: await projectSkillRoots(cwd),
          }),
        };
      case 'create':
        return await serialized(() => createSkill(payload, cwd));
      case 'save':
        return await serialized(() => saveSkill(payload, cwd));
      case 'delete':
        return await serialized(() => deleteSkill(payload, cwd));
      case 'import': {
        let content = typeof payload.content === 'string' ? payload.content : '';
        if (content.trim().length === 0) {
          const sourceUrl = typeof payload.sourceUrl === 'string' ? payload.sourceUrl.trim() : '';
          if (sourceUrl.length === 0) {
            return { kind: 'error', text: 'Choose a file or provide an address first.' };
          }
          // Network I/O happens outside the write queue so a slow remote fetch
          // cannot block local saves in other sessions.
          content = await fetchSkillSource(ctx, sourceUrl);
        }
        return await serialized(() => importSkill({ ...payload, content }, cwd));
      }
      default:
        return { kind: 'error', text: `skill-hub: unknown op "${String(payload.op)}"` };
    }
  } catch (error) {
    return {
      kind: 'error',
      text: `skill-hub: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

let chain = Promise.resolve();
function serialized(task) {
  const next = chain.then(task, task);
  chain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

/** Hard dependency on the command registry. */
export const inject = ['commands'];

export function apply(ctx) {
  ctx.effect(
    () =>
      ctx.commands.register({
        name: 'skill-hub',
        description: 'Create, edit, move, or delete workspace and user-level skill files for the skill panel',
        recordInput: false,
        handler: (invocation) => handle(invocation, ctx),
      }),
    'skill-hub: command',
  );
}

/** Test surface for the package's pure helpers. */
export const __test = {
  NAME_PATTERN,
  buildSkillFile,
  patchFrontmatter,
  validateSkillContent,
  normalizeTags,
  skillLayout,
  skillNameOfPath,
  userSkillRoots,
  projectSkillRoots,
  findProjectRoot,
  allowedSkill,
  contentHash,
  sourceCandidates,
  fetchSkillSource,
  assertPublicUrl,
  isPrivateAddress,
  createSkill,
  importSkill,
  saveSkill,
  deleteSkill,
};
