'use client';
import React, { useEffect } from 'react';
import { useNavigate } from '../lib/nav';
import { useSession } from '../lib/session';
import { ArrowRight, Users, Sparkles, Play, Loader2 } from 'lucide-react';
import { Button, Logo, Kbd } from '../ui';
import { LogoMark } from '../ui/Logo';

/** Static, faithful miniature of the real IDE (same tokens & structure) — no stock illustration. */
function IdePreview() {
  return (
    <div className="preview" aria-hidden>
      <div className="preview__top">
        <LogoMark size={14} />
        <span style={{ color: 'var(--text-2)' }}>algo-lab</span>
        <span>· main</span>
        <span className="preview__run">▶ Run</span>
      </div>
      <div className="preview__body">
        <div className="preview__act"><i /><i /><i /><i /><i /><i /></div>
        <div className="preview__side">
          <div style={{ color: 'var(--text-2)', fontSize: 9, letterSpacing: '0.08em', fontWeight: 600 }}>EXPLORER</div>
          <div>▾ src</div>
          <div className="is-active" style={{ paddingLeft: 18 }}><span className="ftype" style={{ '--ft-color': '#4b8bbe' }}>PY</span>graph.py</div>
          <div style={{ paddingLeft: 18 }}><span className="ftype" style={{ '--ft-color': '#4b8bbe' }}>PY</span>bfs.py</div>
          <div style={{ paddingLeft: 18 }}><span className="ftype" style={{ '--ft-color': '#f1e05a' }}>JS</span>viz.js</div>
          <div>▸ tests</div>
          <div><span className="ftype" style={{ '--ft-color': '#8fa1b3' }}>MD</span>README.md</div>
        </div>
        <div className="preview__editor">
          <div className="preview__tabs">
            <span className="preview__tab is-active"><span className="ftype" style={{ '--ft-color': '#4b8bbe' }}>PY</span>graph.py</span>
            <span className="preview__tab"><span className="ftype" style={{ '--ft-color': '#4b8bbe' }}>PY</span>bfs.py <span style={{ color: 'var(--modified)' }}>●</span></span>
          </div>
          <div className="preview__code">
            <div><span className="ln">1</span><span className="k">from</span> collections <span className="k">import</span> deque</div>
            <div><span className="ln">2</span></div>
            <div><span className="ln">3</span><span className="k">def</span> <span className="f">shortest_path</span>(graph, start, goal):</div>
            <div><span className="ln">4</span>    <span className="c"># breadth-first search over an adjacency dict</span></div>
            <div><span className="ln">5</span>    queue = deque([[start]])</div>
            <div><span className="ln">6</span>    seen = {'{'}start{'}'}</div>
            <div className="active"><span className="ln">7</span>    <span className="k">while</span> queue:<span className="cursor" /><span className="g">  path = queue.popleft()</span><span style={{ marginLeft: 8, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3, padding: '0 3px', fontSize: 9, color: 'var(--text-3)', fontFamily: 'var(--font-ui)', fontStyle: 'normal' }}>Tab</span></div>
            <div><span className="ln">8</span></div>
            <div><span className="ln">9</span><span className="k">if</span> __name__ == <span className="s">&quot;__main__&quot;</span>:</div>
            <div><span className="ln">10</span>    print(shortest_path(G, <span className="s">&quot;a&quot;</span>, <span className="s">&quot;f&quot;</span>))</div>
          </div>
          <div className="preview__term">
            <div><b>❯</b> python3 graph.py</div>
            <div><em>[&apos;a&apos;, &apos;c&apos;, &apos;f&apos;]</em></div>
            <div style={{ color: 'var(--success)' }}>● exited normally · 412ms</div>
          </div>
        </div>
        <div className="preview__ai">
          <div className="t"><Sparkles style={{ width: 10, height: 10 }} /> Assistant</div>
          <div style={{ fontSize: 9.5 }}>Working on: <span style={{ color: 'var(--text-2)' }}>src/graph.py</span></div>
          <div className="chips"><span>Fix errors</span><span>Explain</span><span>Refactor</span><span>Tests</span></div>
          <div className="pmsg">Use <code style={{ background: 'rgba(255,255,255,0.07)', padding: '0 3px', borderRadius: 2 }}>set.add</code> after enqueueing to avoid revisiting nodes. Here&apos;s the fixed loop… <br /><span className="apply">Apply</span></div>
        </div>
      </div>
      <div className="preview__status">
        <span>main</span><span className="live">● Live · 3</span><span>Ln 7, Col 16</span><span>Python</span><span className="ai">✦ AI on</span>
      </div>
    </div>
  );
}

export default function Landing() {
  const { signIn, isAuthenticated, isLoading } = useSession();
  const error = null;
  const navigate = useNavigate();

  useEffect(() => {
    document.body.classList.add('page-scroll');
    document.title = 'Codev — collaborative code editor with an AI pair programmer';
    return () => document.body.classList.remove('page-scroll');
  }, []);
  useEffect(() => { if (isAuthenticated) navigate('/dashboard'); }, [isAuthenticated, navigate]);

  return (
    <div className="page">
      <nav className="page__nav">
        <Logo />
        <span className="u-grow" />
        <div className="page__nav-links">
          <Button variant="ghost" size="sm" onClick={() => window.open('https://github.com/codedpool/codev', '_blank', 'noopener')}>GitHub</Button>
          <Button variant="primary" size="sm" onClick={() => signIn()} loading={isLoading}>Sign in</Button>
        </div>
      </nav>
      <section className="landing">
        <div>
          <span className="landing__eyebrow"><span className="cv-dot cv-dot--accent" /> Real-time collaboration · AI assistant · Cloud run</span>
          <h1 className="landing__title">The code editor that codes <b>with</b> you.</h1>
          <p className="landing__sub">Codev is a browser IDE for pairing: shared cursors, an assistant that understands the file you’re in, and one-key execution for Python, JavaScript, C++ and Java.</p>
          <div className="landing__cta">
            <Button variant="primary" size="lg" iconRight={<ArrowRight />} onClick={() => signIn()} loading={isLoading}>Get started — it&apos;s free</Button>
            <Button variant="ghost" size="lg" onClick={() => navigate('/dashboard')}>Open dashboard</Button>
          </div>
          <div className="landing__meta">
            {isLoading ? <><Loader2 style={{ width: 12, height: 12, animation: 'cv-spin 0.9s linear infinite' }} /> Checking session…</> : error ? <span style={{ color: 'var(--danger)' }}>Sign-in error: {error.message}</span> : <>Free during preview · no credit card · <Kbd combo="Mod+K" /> everywhere</>}
          </div>
          <div className="landing__features">
            <div className="landing__feature"><Users /><h4>Pair in real time</h4><p>Named cursors, presence in the explorer, and conflict-free shared documents.</p></div>
            <div className="landing__feature landing__feature--ai"><Sparkles /><h4>AI that knows the file</h4><p>Fix, explain, refactor, test — and apply the answer straight into the editor.</p></div>
            <div className="landing__feature"><Play /><h4>Run without setup</h4><p>Python, Node, C++17 and Java execute in the cloud with stdin support.</p></div>
          </div>
        </div>
        <IdePreview />
      </section>
      <footer className="page__foot">
        <span>© Codev · built at HAXPLORE-CODEFEST’25</span>
        <span>ISC License</span>
      </footer>
    </div>
  );
}
