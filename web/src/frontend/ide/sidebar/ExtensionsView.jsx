'use client';
import React, { useState } from 'react';
import { Sparkles, Map, WrapText, Braces, Save, Palette, Search, Blocks, Type } from 'lucide-react';
import { Input, Switch, SectionHeader } from '../../ui';
import { useWorkspace } from '../WorkspaceContext';
import { EDITOR_THEMES } from '../../editor/theme';

/**
 * Built-in capabilities are presented as toggleable "extensions". Every toggle is real and
 * changes editor behaviour immediately.
 */
export default function ExtensionsView() {
  const { settings, setSettings } = useWorkspace();
  const [q, setQ] = useState('');
  const items = [
    { id: 'inlineAi', name: 'AI Inline Suggestions', desc: 'Ghost-text completions while you type. Tab to accept, Esc to dismiss.', icon: <Sparkles />, on: settings.inlineAi, toggle: (v) => setSettings({ inlineAi: v }), tag: 'AI' },
    { id: 'minimap', name: 'Minimap', desc: 'Compact overview of the file next to the scrollbar.', icon: <Map />, on: settings.minimap, toggle: (v) => setSettings({ minimap: v }) },
    { id: 'wordWrap', name: 'Word Wrap', desc: 'Soft-wrap long lines to the editor width.', icon: <WrapText />, on: settings.wordWrap, toggle: (v) => setSettings({ wordWrap: v }) },
    { id: 'ligatures', name: 'Font Ligatures', desc: 'Render => and !== as ligatures with JetBrains Mono.', icon: <Type />, on: settings.ligatures, toggle: (v) => setSettings({ ligatures: v }) },
    { id: 'autoSave', name: 'Auto Save', desc: 'Save files 1.5s after you stop typing.', icon: <Save />, on: settings.autoSave, toggle: (v) => setSettings({ autoSave: v }) },
    { id: 'lineNumbers', name: 'Line Numbers', desc: 'Show the line-number gutter.', icon: <Braces />, on: settings.lineNumbers, toggle: (v) => setSettings({ lineNumbers: v }) },
  ];
  const themes = EDITOR_THEMES.map((t) => ({ id: `theme-${t.id}`, name: t.label, desc: t.id === 'codev-dark' ? 'The default Codev syntax theme.' : 'Classic Atom One Dark colours.', icon: <Palette />, on: settings.theme === t.id, toggle: () => setSettings({ theme: t.id }), radio: true }));
  const all = [...items, ...themes].filter((i) => !q || i.name.toLowerCase().includes(q.toLowerCase()) || i.desc.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="sidebar__body">
      <div className="sidebar__filter" style={{ paddingTop: 6 }}>
        <Input size="sm" icon={<Search />} placeholder="Search extensions" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <SectionHeader title="Installed" badge={<span className="cv-badge cv-badge--count">{all.length}</span>} />
      <div className="sidebar__list">
        {all.map((it) => (
          <div key={it.id} className="ext">
            <span className="ext__icon">{it.icon}</span>
            <div className="ext__body">
              <div className="ext__name">{it.name}{it.tag ? <span className="cv-badge cv-badge--ai">{it.tag}</span> : null}{it.radio && it.on ? <span className="cv-badge cv-badge--accent">active</span> : null}</div>
              <div className="ext__desc">{it.desc}</div>
            </div>
            <Switch checked={!!it.on} onChange={(v) => it.toggle(v)} label={it.name} disabled={it.radio && it.on} />
          </div>
        ))}
        {!all.length ? <div className="sidebar__hint">No extensions match “{q}”.</div> : null}
      </div>
      <SectionHeader title="Marketplace" />
      <div className="sidebar__hint" style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <Blocks style={{ width: 14, height: 14, flex: 'none', marginTop: 2 }} />
        <span>Third-party extensions aren’t available yet. Language support for JavaScript, TypeScript, Python, Java, C/C++, HTML, CSS, JSON and Markdown is built in.</span>
      </div>
    </div>
  );
}
