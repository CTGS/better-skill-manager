import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const base = await fs.mkdtemp(path.join(os.tmpdir(), 'bsm-test-'));
process.env.DSH_HOME = path.join(base, 'home');
process.env.DSH_AGENTS_HOME = path.join(base, 'agents');

const { __test } = await import('../index.js');
const {
  buildSkillFile,
  saveSkill,
  createSkill,
  importSkill,
  validateSkillContent,
  normalizeTags,
  contentHash,
  sourceCandidates,
  assertPublicUrl,
  fetchSkillSource,
  projectSkillRoots,
  userSkillRoots,
  skillLayout,
} = __test;

const cwd = path.join(base, 'project');
const agentsRoot = path.join(base, 'agents', 'skills');
const homeRoot = path.join(base, 'home', 'skills');
const demoFile = path.join(agentsRoot, 'demo', 'SKILL.md');
const demoContent = '---\nname: "demo"\ndescription: "Demo skill"\nmanaged-by: "skill-hub"\n---\n\nBody\n';

test.before(async () => {
  await fs.mkdir(path.join(cwd, '.git'), { recursive: true });
  await fs.mkdir(path.join(cwd, '.dsh', 'skills'), { recursive: true });
  await fs.mkdir(path.join(base, 'agents', 'skills', 'demo'), { recursive: true });
  await fs.mkdir(homeRoot, { recursive: true });
  await fs.writeFile(demoFile, demoContent, 'utf8');
});

test.after(async () => {
  await fs.rm(base, { recursive: true, force: true });
});

test('buildSkillFile records its manager marker', () => {
  const content = buildSkillFile({ name: 'demo', description: 'Demo', body: 'Body', tags: ['alpha'] });
  assert.match(content, /^---\nname: "demo"/u);
  assert.match(content, /managed-by: "skill-hub"/u);
});

test('an untouched .agents skill stays in .agents', async () => {
  const result = await saveSkill(
    { path: demoFile, name: 'demo', content: demoContent.replace('Body', 'Body 2'), tags: ['alpha'] },
    cwd,
  );
  assert.equal(result.kind, 'success');
  assert.match(JSON.parse(result.text).path, /agents[\\/]skills[\\/]demo/u);
  await fs.access(demoFile);
  await assert.rejects(() => fs.access(path.join(homeRoot, 'demo', 'SKILL.md')));
});

test('nested resources are not accepted as skills', async () => {
  const nested = path.join(base, 'agents', 'skills', 'demo', 'references', 'guide.md');
  await fs.mkdir(path.dirname(nested), { recursive: true });
  await fs.writeFile(nested, '# guide\n', 'utf8');
  assert.equal(skillLayout(agentsRoot, nested), undefined);
  const result = await saveSkill({ path: nested, name: 'demo', content: demoContent }, cwd);
  assert.equal(result.kind, 'error');
});

test('empty content and stale content are rejected', async () => {
  const empty = await saveSkill({ path: demoFile, name: 'demo', content: '   ' }, cwd);
  assert.equal(empty.kind, 'error');
  const stale = await saveSkill(
    { path: demoFile, name: 'demo', content: demoContent, baseHash: 'fnv1a-deadbeef' },
    cwd,
  );
  assert.equal(stale.kind, 'error');
});

test('scope moves are explicit and preserve bundle layout', async () => {
  const moved = await saveSkill({ path: demoFile, name: 'demo', content: demoContent, scope: 'session' }, cwd);
  assert.equal(moved.kind, 'success');
  const target = path.join(cwd, '.dsh', 'skills', 'demo', 'SKILL.md');
  await fs.access(target);
  const back = await saveSkill({ path: target, name: 'demo', content: demoContent, scope: 'user' }, cwd);
  assert.equal(back.kind, 'success');
  assert.match(JSON.parse(back.text).path, /home[\\/]skills[\\/]demo/u);
});

test('names may start with a digit and duplicate names are refused', async () => {
  const first = await createSkill({ name: '2fa', description: 'Second factor', body: 'Body', scope: 'user' }, cwd);
  assert.equal(first.kind, 'success');
  const second = await createSkill({ name: '2fa', description: 'Second factor', body: 'Body', scope: 'user' }, cwd);
  assert.equal(second.kind, 'error');
});

test('invalid or incomplete frontmatter is rejected', () => {
  assert.throws(() => validateSkillContent('---\nname: "x"\n---\n\nBody\n'), /description/u);
  assert.throws(
    () => validateSkillContent('---\nname: >-\n  x\ndescription: "d"\n---\n\nBody\n'),
    /block scalar/u,
  );
});

test('tags are normalized and quotes removed', () => {
  assert.deepEqual(normalizeTags([' "quoted" ', '#hash', '内置', 'quoted']), ['quoted', 'hash']);
});

test('GitHub blob addresses resolve to a raw candidate', () => {
  assert.deepEqual(
    sourceCandidates('https://github.com/owner/repo/blob/main/skills/demo/SKILL.md'),
    ['https://raw.githubusercontent.com/owner/repo/main/skills/demo/SKILL.md'],
  );
});

test('private addresses are rejected', async () => {
  for (const url of [
    'http://127.0.0.1/SKILL.md',
    'http://192.168.1.5/SKILL.md',
    'http://169.254.1.1/SKILL.md',
    'http://[::1]/SKILL.md',
    'http://[::ffff:127.0.0.1]/SKILL.md',
    'file:///C:/x/SKILL.md',
    'http://user:pass@93.184.216.34/SKILL.md',
  ]) {
    await assert.rejects(() => assertPublicUrl(url), /private|http\(s\)|credentials/u, url);
  }
  await assert.doesNotReject(() => assertPublicUrl('http://93.184.216.34/SKILL.md'));
});

test('a web-service policy error is final, not retried natively', async () => {
  let nativeCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    nativeCalls += 1;
    return new Response('nope', { status: 500 });
  };
  try {
    const ctx = {
      get: (name) =>
        name === 'web'
          ? { fetch: async () => { throw new Error('WEB_REDIRECT_BLOCKED'); } }
          : undefined,
    };
    await assert.rejects(() => fetchSkillSource(ctx, 'http://93.184.216.34/SKILL.md'), /redirect/iu);
    assert.equal(nativeCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('roots include both user roots and both project roots', async () => {
  assert.deepEqual(
    userSkillRoots().map((entry) => path.resolve(entry)),
    [path.join(base, 'home', 'skills'), path.join(base, 'agents', 'skills')].map((entry) => path.resolve(entry)),
  );
  const project = await projectSkillRoots(cwd);
  assert.equal(project.length, 2);
  assert.ok(project.some((entry) => entry.endsWith(path.join('.dsh', 'skills'))));
  assert.ok(project.some((entry) => entry.endsWith(path.join('.agents', 'skills'))));
});

test('the manager marker survives a save and is added by an import', async () => {
  const markerFile = path.join(agentsRoot, 'marker', 'SKILL.md');
  await fs.mkdir(path.dirname(markerFile), { recursive: true });
  await fs.writeFile(markerFile, demoContent.replaceAll('demo', 'marker'), 'utf8');
  const saved = await saveSkill(
    { path: markerFile, name: 'marker', content: demoContent.replaceAll('demo', 'marker'), tags: ['x'] },
    cwd,
  );
  assert.equal(saved.kind, 'success');
  assert.match(await fs.readFile(markerFile, 'utf8'), /managed-by: "skill-hub"/u);

  const imported = await importSkill(
    {
      name: 'imported',
      content: '---\nname: "old"\ndescription: "Imported"\n---\n\nBody\n',
      tags: [],
      scope: 'user',
    },
    cwd,
  );
  assert.equal(imported.kind, 'success');
  const text = await fs.readFile(path.join(homeRoot, 'imported', 'SKILL.md'), 'utf8');
  assert.match(text, /managed-by: "skill-hub"/u);
  assert.match(text, /name: "imported"/u);
});

test('contentHash is stable and distinguishes content', () => {
  assert.equal(contentHash('abc'), contentHash('abc'));
  assert.notEqual(contentHash('abc'), contentHash('abd'));
});

test('raw-byte base hashes match for LF and CRLF files', async () => {
  const lf = '---\nname: "hash-lf"\ndescription: "D"\n---\n\nBody\n';
  const lfFile = path.join(agentsRoot, 'hash-lf', 'SKILL.md');
  await fs.mkdir(path.dirname(lfFile), { recursive: true });
  await fs.writeFile(lfFile, lf, 'utf8');
  const lfSave = await saveSkill(
    {
      path: lfFile,
      name: 'hash-lf',
      content: lf.replace('Body', 'Body 2'),
      tags: [],
      nameChanged: false,
      tagsChanged: false,
      baseHash: contentHash(lf),
    },
    cwd,
  );
  assert.equal(lfSave.kind, 'success');

  const crlf = '---\r\nname: "hash-crlf"\r\ndescription: "D"\r\n---\r\n\r\nBody\r\n';
  const crlfFile = path.join(agentsRoot, 'hash-crlf', 'SKILL.md');
  await fs.mkdir(path.dirname(crlfFile), { recursive: true });
  await fs.writeFile(crlfFile, crlf, 'utf8');
  const crlfSave = await saveSkill(
    {
      path: crlfFile,
      name: 'hash-crlf',
      content: crlf.replace('Body', 'Body 2'),
      tags: [],
      nameChanged: false,
      tagsChanged: false,
      baseHash: contentHash(crlf),
    },
    cwd,
  );
  assert.equal(crlfSave.kind, 'success');
});

test('a failed atomic replace leaves the original intact', async () => {
  const file = path.join(agentsRoot, 'atomic', 'SKILL.md');
  await fs.mkdir(path.dirname(file), { recursive: true });
  const before = '---\nname: "atomic"\ndescription: "D"\n---\n\nOriginal\n';
  await fs.writeFile(file, before, 'utf8');
  const originalRename = fs.rename;
  fs.rename = async () => {
    const error = new Error('io');
    error.code = 'EIO';
    throw error;
  };
  try {
    await assert.rejects(() =>
      saveSkill(
        {
          path: file,
          name: 'atomic',
          content: before.replace('Original', 'Changed'),
          tags: [],
          nameChanged: false,
          tagsChanged: false,
          baseHash: contentHash(before),
        },
        cwd,
      ),
    );
  } finally {
    fs.rename = originalRename;
  }
  assert.equal(await fs.readFile(file, 'utf8'), before);
  assert.equal(
    (await fs.readdir(path.dirname(file))).filter((name) => name.endsWith('.tmp')).length,
    0,
  );
});

test('an exclusive create never overwrites an externally created target', async () => {
  const name = 'race-created';
  const file = path.join(homeRoot, name, 'SKILL.md');
  const originalWriteFile = fs.writeFile;
  let injected = false;
  fs.writeFile = async (target, content, options) => {
    if (!injected && path.resolve(target) === path.resolve(file)) {
      injected = true;
      await originalWriteFile(target, 'external', 'utf8');
    }
    return originalWriteFile(target, content, options);
  };
  try {
    const result = await createSkill({ name, description: 'D', body: 'B', scope: 'user' }, cwd);
    assert.equal(result.kind, 'error');
  } finally {
    fs.writeFile = originalWriteFile;
  }
  assert.equal(await fs.readFile(file, 'utf8'), 'external');
});

test('invalid YAML is rejected and the original is preserved', async () => {
  const file = path.join(agentsRoot, 'yaml-invalid', 'SKILL.md');
  await fs.mkdir(path.dirname(file), { recursive: true });
  const before = '---\nname: "yaml-invalid"\ndescription: "D"\n---\n\nBody\n';
  await fs.writeFile(file, before, 'utf8');
  const invalid = '---\nname: "yaml-invalid"\ndescription: "D"\nmetadata: [\n---\n\nBody\n';
  await assert.rejects(
    () =>
      saveSkill(
        {
          path: file,
          name: 'yaml-invalid',
          content: invalid,
          tags: [],
          nameChanged: false,
          tagsChanged: false,
          baseHash: contentHash(before),
        },
        cwd,
      ),
    /flow|unbalanced/u,
  );
  assert.equal(await fs.readFile(file, 'utf8'), before);
  assert.throws(
    () => validateSkillContent('---\nname: "x"\ndescription: "D"\nfoo: bar: baz\n---\n\nBody\n'),
    /mapping value/u,
  );
});

test('unchanged multi-line tags survive, changed tags replace the whole block', async () => {
  const file = path.join(agentsRoot, 'multi-tags', 'SKILL.md');
  await fs.mkdir(path.dirname(file), { recursive: true });
  const before = '---\nname: "multi-tags"\ndescription: "D"\ntags: [\n  alpha,\n  beta\n]\n---\n\nBody\n';
  await fs.writeFile(file, before, 'utf8');
  const kept = await saveSkill(
    {
      path: file,
      name: 'multi-tags',
      content: before,
      tags: ['alpha', 'beta'],
      nameChanged: false,
      tagsChanged: false,
      baseHash: contentHash(before),
    },
    cwd,
  );
  assert.equal(kept.kind, 'success');
  const keptText = await fs.readFile(file, 'utf8');
  assert.match(keptText, /tags: \[\n  alpha,\n  beta\n\]/u);

  const changed = await saveSkill(
    {
      path: file,
      name: 'multi-tags',
      content: keptText,
      tags: ['gamma'],
      nameChanged: false,
      tagsChanged: true,
      baseHash: contentHash(keptText),
    },
    cwd,
  );
  assert.equal(changed.kind, 'success');
  const text = await fs.readFile(file, 'utf8');
  assert.match(text, /tags: \["gamma"\]/u);
  assert.doesNotMatch(text, /alpha/u);
  assert.doesNotMatch(text, /beta/u);
});

test('a block scalar description survives a name/tag rewrite', async () => {
  const file = path.join(agentsRoot, 'block-desc', 'SKILL.md');
  await fs.mkdir(path.dirname(file), { recursive: true });
  const before = '---\nname: "block-desc"\ndescription: >-\n  A long description\n  on two lines.\n---\n\nBody\n';
  await fs.writeFile(file, before, 'utf8');
  const saved = await saveSkill(
    {
      path: file,
      name: 'block-desc',
      content: before,
      tags: ['x'],
      nameChanged: false,
      tagsChanged: true,
      baseHash: contentHash(before),
    },
    cwd,
  );
  assert.equal(saved.kind, 'success');
  const text = await fs.readFile(file, 'utf8');
  assert.match(text, /description: >-/u);
  assert.match(text, /A long description/u);
});

test('import preserves source tags when the form did not specify tags', async () => {
  const result = await importSkill(
    {
      name: 'tag-preserved',
      content: '---\nname: "old"\ndescription: "D"\ntags: ["original-tag"]\n---\n\nBody\n',
      scope: 'user',
    },
    cwd,
  );
  assert.equal(result.kind, 'success');
  const text = await fs.readFile(path.join(homeRoot, 'tag-preserved', 'SKILL.md'), 'utf8');
  assert.match(text, /original-tag/u);
});

test('an explicit empty tags array clears source tags', async () => {
  const result = await importSkill(
    {
      name: 'tag-cleared',
      content: '---\nname: "old"\ndescription: "D"\ntags: ["original-tag"]\n---\n\nBody\n',
      tags: [],
      scope: 'user',
    },
    cwd,
  );
  assert.equal(result.kind, 'success');
  const text = await fs.readFile(path.join(homeRoot, 'tag-cleared', 'SKILL.md'), 'utf8');
  assert.doesNotMatch(text, /original-tag/u);
  assert.doesNotMatch(text, /tags:/u);
});
